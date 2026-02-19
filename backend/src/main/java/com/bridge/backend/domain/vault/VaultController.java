package com.bridge.backend.domain.vault;

import com.bridge.backend.common.api.ApiSuccess;
import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.MemberRole;
import com.bridge.backend.common.model.enums.VaultAccessRequestStatus;
import com.bridge.backend.common.model.enums.VaultSecretType;
import com.bridge.backend.common.security.SecurityUtils;
import com.bridge.backend.common.tenant.AccessGuardService;
import com.bridge.backend.domain.notification.OutboxService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
public class VaultController {
    private final VaultPolicyRepository policyRepository;
    private final VaultSecretRepository secretRepository;
    private final VaultAccessRequestRepository accessRequestRepository;
    private final VaultAccessEventRepository accessEventRepository;
    private final VaultCryptoService vaultCryptoService;
    private final AccessGuardService guardService;
    private final OutboxService outboxService;
    private final ObjectMapper objectMapper;

    public VaultController(VaultPolicyRepository policyRepository,
                           VaultSecretRepository secretRepository,
                           VaultAccessRequestRepository accessRequestRepository,
                           VaultAccessEventRepository accessEventRepository,
                           VaultCryptoService vaultCryptoService,
                           AccessGuardService guardService,
                           OutboxService outboxService,
                           ObjectMapper objectMapper) {
        this.policyRepository = policyRepository;
        this.secretRepository = secretRepository;
        this.accessRequestRepository = accessRequestRepository;
        this.accessEventRepository = accessEventRepository;
        this.vaultCryptoService = vaultCryptoService;
        this.guardService = guardService;
        this.outboxService = outboxService;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/api/projects/{projectId}/vault/policies")
    public ApiSuccess<List<VaultPolicyEntity>> policies(@PathVariable UUID projectId) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMember(projectId, principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(policyRepository.findByProjectIdAndTenantIdAndDeletedAtIsNull(projectId, principal.getTenantId()));
    }

    @PostMapping("/api/projects/{projectId}/vault/policies")
    public ApiSuccess<VaultPolicyEntity> createPolicy(@PathVariable UUID projectId, @RequestBody @Valid CreatePolicyRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        VaultPolicyEntity policy = new VaultPolicyEntity();
        policy.setTenantId(principal.getTenantId());
        policy.setProjectId(projectId);
        policy.setName(request.name());
        policy.setRuleJson(request.ruleJson());
        policy.setCreatedBy(principal.getUserId());
        policy.setUpdatedBy(principal.getUserId());
        return ApiSuccess.of(policyRepository.save(policy));
    }

    @GetMapping("/api/projects/{projectId}/vault/secrets")
    public ApiSuccess<List<VaultSecretEntity>> listSecrets(@PathVariable UUID projectId) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMember(projectId, principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(secretRepository.findByProjectIdAndTenantIdAndDeletedAtIsNull(projectId, principal.getTenantId()));
    }

    @GetMapping("/api/projects/{projectId}/vault/account-requests")
    public ApiSuccess<List<VaultSecretEntity>> accountRequests(@PathVariable UUID projectId) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMember(projectId, principal.getUserId(), principal.getTenantId());
        List<VaultSecretEntity> requests = secretRepository.findByProjectIdAndTenantIdAndDeletedAtIsNull(projectId, principal.getTenantId())
                .stream()
                .filter(secret -> secret.getRequestReason() != null && !secret.getRequestReason().isBlank())
                .collect(Collectors.toList());
        return ApiSuccess.of(requests);
    }

    @PostMapping("/api/projects/{projectId}/vault/secrets")
    public ApiSuccess<VaultSecretEntity> createSecret(@PathVariable UUID projectId, @RequestBody @Valid CreateSecretRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        VaultSecretEntity entity = buildSecretEntity(principal.getTenantId(), projectId, principal.getUserId(),
                request.name(),
                request.type() == null ? VaultSecretType.OTHER : request.type(),
                request.plainSecret(),
                request.siteUrl(),
                request.requestReason());
        return ApiSuccess.of(secretRepository.save(entity));
    }

    @PostMapping("/api/projects/{projectId}/vault/account-requests")
    public ApiSuccess<VaultSecretEntity> createAccountRequest(@PathVariable UUID projectId,
                                                              @RequestBody @Valid CreateAccountRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        VaultSecretEntity entity = buildSecretEntity(principal.getTenantId(), projectId, principal.getUserId(),
                request.platformName(),
                VaultSecretType.OTHER,
                "PENDING",
                request.siteUrl(),
                request.requestReason());
        entity.setCredentialReady(false);
        entity.setProvidedByUserId(null);
        entity.setProvidedAt(null);
        VaultSecretEntity saved = secretRepository.save(entity);
        outboxService.publish(principal.getTenantId(), principal.getUserId(), "vault_secret", saved.getId(),
                "vault.account.requested", "Vault account requested", saved.getName(), Map.of("secretId", saved.getId()));
        return ApiSuccess.of(saved);
    }

    @PatchMapping("/api/vault/secrets/{secretId}/provision")
    public ApiSuccess<VaultSecretEntity> provisionSecret(@PathVariable UUID secretId,
                                                         @RequestBody @Valid ProvisionSecretRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        VaultSecretEntity secret = requireActiveSecret(secretId);
        guardService.requireProjectMemberRole(secret.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.CLIENT_OWNER, MemberRole.CLIENT_MEMBER, MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        VaultCryptoService.EncryptedSecret encrypted = vaultCryptoService.encrypt(request.plainSecret());
        secret.setSecretCiphertext(encrypted.ciphertext());
        secret.setNonce(encrypted.nonce());
        secret.setVersion(secret.getVersion() + 1);
        secret.setCredentialReady(true);
        secret.setProvidedByUserId(principal.getUserId());
        secret.setProvidedAt(OffsetDateTime.now());
        secret.setUpdatedBy(principal.getUserId());
        VaultSecretEntity saved = secretRepository.save(secret);
        outboxService.publish(principal.getTenantId(), principal.getUserId(), "vault_secret", saved.getId(),
                "vault.account.provisioned", "Vault account provided", saved.getName(), Map.of("secretId", saved.getId()));
        return ApiSuccess.of(saved);
    }

    @PostMapping("/api/vault/secrets/{secretId}/access-requests")
    public ApiSuccess<VaultAccessRequestEntity> requestAccess(@PathVariable UUID secretId) {
        var principal = SecurityUtils.requirePrincipal();
        VaultSecretEntity secret = requireActiveSecret(secretId);
        guardService.requireProjectMember(secret.getProjectId(), principal.getUserId(), principal.getTenantId());
        VaultAccessRequestEntity request = new VaultAccessRequestEntity();
        request.setTenantId(principal.getTenantId());
        request.setSecretId(secretId);
        request.setRequesterUserId(principal.getUserId());
        request.setStatus(VaultAccessRequestStatus.REQUESTED);
        request.setExpiresAt(OffsetDateTime.now().plusHours(24));
        request.setCreatedBy(principal.getUserId());
        request.setUpdatedBy(principal.getUserId());
        VaultAccessRequestEntity saved = accessRequestRepository.save(request);
        outboxService.publish(principal.getTenantId(), principal.getUserId(), "vault_access_request", saved.getId(),
                "vault.access.requested", "Vault access requested", secret.getName(), Map.of("secretId", secretId));
        return ApiSuccess.of(saved);
    }

    @PatchMapping("/api/vault/access-requests/{requestId}")
    public ApiSuccess<VaultAccessRequestEntity> patchRequest(@PathVariable UUID requestId, @RequestBody @Valid PatchRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        if (request.status() == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, "ACCESS_REQUEST_STATUS_REQUIRED", "Access request status is required.");
        }
        if (request.status() == VaultAccessRequestStatus.REQUESTED) {
            throw new AppException(HttpStatus.BAD_REQUEST, "ACCESS_REQUEST_STATUS_INVALID", "Cannot transition to REQUESTED.");
        }
        VaultAccessRequestEntity accessRequest = accessRequestRepository.findById(requestId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "ACCESS_REQUEST_NOT_FOUND", "Access request not found."));
        VaultSecretEntity secret = requireActiveSecret(accessRequest.getSecretId());
        guardService.requireProjectMemberRole(secret.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        accessRequest.setStatus(request.status());
        accessRequest.setApproverUserId(principal.getUserId());
        accessRequest.setUpdatedBy(principal.getUserId());
        VaultAccessRequestEntity saved = accessRequestRepository.save(accessRequest);
        outboxService.publish(principal.getTenantId(), principal.getUserId(), "vault_access_request", saved.getId(),
                "vault.access.reviewed", "Vault access reviewed", saved.getStatus().name(), Map.of("requestId", saved.getId()));
        return ApiSuccess.of(saved);
    }

    @PostMapping("/api/vault/secrets/{secretId}/reveal")
    public ApiSuccess<Map<String, Object>> reveal(@PathVariable UUID secretId) {
        var principal = SecurityUtils.requirePrincipal();
        VaultSecretEntity secret = requireActiveSecret(secretId);
        var member = guardService.requireProjectMember(secret.getProjectId(), principal.getUserId(), principal.getTenantId());

        if (!secret.isCredentialReady()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "SECRET_NOT_READY", "Credential is not ready yet.");
        }

        VaultRevealPolicy policy = resolveRevealPolicy(secret.getProjectId(), principal.getTenantId());
        enforceTtlPolicy(secret, policy);
        enforceMaxViewsPolicy(secretId, principal.getTenantId(), principal.getUserId(), policy);

        UUID accessRequestId = null;
        if (policy.requireApprovedRequest() || isClientRole(member.getRole())) {
            VaultAccessRequestEntity accessRequest = accessRequestRepository
                    .findTopBySecretIdAndRequesterUserIdAndTenantIdAndDeletedAtIsNullOrderByCreatedAtDesc(secretId, principal.getUserId(), principal.getTenantId())
                    .orElseThrow(() -> new AppException(HttpStatus.FORBIDDEN, "ACCESS_REQUEST_REQUIRED", "Approved access request is required."));
            if (accessRequest.getStatus() != VaultAccessRequestStatus.APPROVED) {
                throw new AppException(HttpStatus.FORBIDDEN, "ACCESS_REQUEST_NOT_APPROVED", "Access request is not approved.");
            }
            if (accessRequest.getExpiresAt() != null && accessRequest.getExpiresAt().isBefore(OffsetDateTime.now())) {
                accessRequest.setStatus(VaultAccessRequestStatus.EXPIRED);
                accessRequest.setUpdatedBy(principal.getUserId());
                accessRequestRepository.save(accessRequest);
                throw new AppException(HttpStatus.FORBIDDEN, "ACCESS_REQUEST_EXPIRED", "Access request has expired.");
            }
            accessRequest.setStatus(VaultAccessRequestStatus.EXPIRED);
            accessRequest.setUpdatedBy(principal.getUserId());
            accessRequestRepository.save(accessRequest);
            accessRequestId = accessRequest.getId();
        }

        String plainText = vaultCryptoService.decrypt(secret.getSecretCiphertext(), secret.getNonce());

        VaultAccessEventEntity accessEvent = new VaultAccessEventEntity();
        accessEvent.setTenantId(principal.getTenantId());
        accessEvent.setSecretId(secretId);
        accessEvent.setRequestId(accessRequestId);
        accessEvent.setViewerUserId(principal.getUserId());
        accessEvent.setCreatedBy(principal.getUserId());
        accessEvent.setUpdatedBy(principal.getUserId());
        accessEventRepository.save(accessEvent);

        outboxService.publish(principal.getTenantId(), principal.getUserId(), "vault_secret", secretId,
                "vault.secret.revealed", "Vault secret revealed", secret.getName(), Map.of("secretId", secretId));
        return ApiSuccess.of(Map.of("secret", plainText, "version", secret.getVersion()));
    }

    private VaultSecretEntity buildSecretEntity(UUID tenantId,
                                                UUID projectId,
                                                UUID actorUserId,
                                                String name,
                                                VaultSecretType type,
                                                String plainSecret,
                                                String siteUrl,
                                                String requestReason) {
        VaultCryptoService.EncryptedSecret encrypted = vaultCryptoService.encrypt(plainSecret);
        VaultSecretEntity entity = new VaultSecretEntity();
        entity.setTenantId(tenantId);
        entity.setProjectId(projectId);
        entity.setName(name);
        entity.setType(type);
        entity.setSiteUrl(siteUrl);
        entity.setRequestReason(requestReason);
        entity.setRequestedByUserId(actorUserId);
        entity.setSecretCiphertext(encrypted.ciphertext());
        entity.setNonce(encrypted.nonce());
        entity.setVersion(encrypted.version());
        entity.setCredentialReady(true);
        entity.setProvidedByUserId(actorUserId);
        entity.setProvidedAt(OffsetDateTime.now());
        entity.setCreatedBy(actorUserId);
        entity.setUpdatedBy(actorUserId);
        return entity;
    }

    private VaultSecretEntity requireActiveSecret(UUID secretId) {
        VaultSecretEntity secret = secretRepository.findById(secretId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "SECRET_NOT_FOUND", "Vault secret not found."));
        if (secret.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "SECRET_NOT_FOUND", "Vault secret not found.");
        }
        return secret;
    }

    private boolean isClientRole(MemberRole role) {
        return role == MemberRole.CLIENT_OWNER || role == MemberRole.CLIENT_MEMBER;
    }

    private void enforceTtlPolicy(VaultSecretEntity secret, VaultRevealPolicy policy) {
        Integer ttlMinutes = policy.ttlMinutes();
        if (ttlMinutes == null || ttlMinutes <= 0 || secret.getProvidedAt() == null) {
            return;
        }
        OffsetDateTime expiresAt = secret.getProvidedAt().plusMinutes(ttlMinutes);
        if (expiresAt.isBefore(OffsetDateTime.now())) {
            throw new AppException(HttpStatus.FORBIDDEN, "SECRET_ACCESS_EXPIRED", "Secret access window has expired.");
        }
    }

    private void enforceMaxViewsPolicy(UUID secretId, UUID tenantId, UUID userId, VaultRevealPolicy policy) {
        Integer maxViewsPerUser = policy.maxViewsPerUser();
        if (maxViewsPerUser == null || maxViewsPerUser <= 0) {
            return;
        }
        long viewedCount = accessEventRepository.countBySecretIdAndTenantIdAndViewerUserIdAndDeletedAtIsNull(secretId, tenantId, userId);
        if (viewedCount >= maxViewsPerUser) {
            throw new AppException(HttpStatus.FORBIDDEN, "SECRET_VIEW_LIMIT_REACHED", "Secret view limit exceeded.");
        }
    }

    private VaultRevealPolicy resolveRevealPolicy(UUID projectId, UUID tenantId) {
        return policyRepository.findByProjectIdAndTenantIdAndDeletedAtIsNull(projectId, tenantId).stream()
                .max(Comparator.comparing(VaultPolicyEntity::getCreatedAt))
                .map(policy -> parsePolicy(policy.getRuleJson()))
                .orElse(VaultRevealPolicy.DEFAULT);
    }

    private VaultRevealPolicy parsePolicy(String ruleJson) {
        if (ruleJson == null || ruleJson.isBlank()) {
            return VaultRevealPolicy.DEFAULT;
        }
        try {
            JsonNode root = objectMapper.readTree(ruleJson);
            boolean requireApprovedRequest = root.path("requireApprovedRequest").asBoolean(VaultRevealPolicy.DEFAULT.requireApprovedRequest());
            Integer maxViews = root.has("maxViews") && !root.path("maxViews").isNull() ? root.path("maxViews").asInt() : null;
            Integer ttlMinutes = root.has("ttlMinutes") && !root.path("ttlMinutes").isNull() ? root.path("ttlMinutes").asInt() : null;
            return new VaultRevealPolicy(requireApprovedRequest, maxViews, ttlMinutes);
        } catch (Exception ignored) {
            return VaultRevealPolicy.DEFAULT;
        }
    }

    public record CreatePolicyRequest(@NotBlank String name, @NotBlank String ruleJson) {
    }

    public record CreateSecretRequest(@NotBlank String name,
                                      VaultSecretType type,
                                      @NotBlank String plainSecret,
                                      String siteUrl,
                                      String requestReason) {
    }

    public record CreateAccountRequest(@NotBlank String platformName,
                                       @NotBlank String requestReason,
                                       @NotBlank String siteUrl) {
    }

    public record ProvisionSecretRequest(@NotBlank String plainSecret) {
    }

    public record PatchRequest(VaultAccessRequestStatus status) {
    }

    private record VaultRevealPolicy(boolean requireApprovedRequest, Integer maxViewsPerUser, Integer ttlMinutes) {
        private static final VaultRevealPolicy DEFAULT = new VaultRevealPolicy(false, null, null);
    }
}
