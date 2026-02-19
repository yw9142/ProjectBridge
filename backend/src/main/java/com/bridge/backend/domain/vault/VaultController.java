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
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@RestController
public class VaultController {
    private static final int DEFAULT_VIEW_TTL_MINUTES = 10;

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
        return ApiSuccess.of(secretRepository.findByProjectIdAndTenantIdAndDeletedAtIsNull(projectId, principal.getTenantId()));
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
            throw new AppException(HttpStatus.BAD_REQUEST, "ACCESS_REQUEST_STATUS_REQUIRED", "Status is required.");
        }
        VaultAccessRequestEntity accessRequest = accessRequestRepository.findById(requestId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "ACCESS_REQUEST_NOT_FOUND", "Access request not found."));
        VaultSecretEntity secret = requireActiveSecret(accessRequest.getSecretId());
        guardService.requireProjectMemberRole(secret.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        if (accessRequest.getStatus() != VaultAccessRequestStatus.REQUESTED) {
            throw new AppException(HttpStatus.CONFLICT, "ACCESS_REQUEST_ALREADY_REVIEWED", "Access request is already reviewed.");
        }

        accessRequest.setStatus(request.status());
        if (request.status() == VaultAccessRequestStatus.APPROVED) {
            VaultRules rules = resolveVaultRules(secret.getProjectId(), principal.getTenantId());
            accessRequest.setExpiresAt(OffsetDateTime.now().plusMinutes(rules.viewTtlMinutes()));
        } else {
            accessRequest.setExpiresAt(OffsetDateTime.now());
        }
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
        VaultRules rules = resolveVaultRules(secret.getProjectId(), principal.getTenantId());

        if (!rules.clientAllowed() && isClientRole(member.getRole())) {
            throw new AppException(HttpStatus.FORBIDDEN, "VAULT_ROLE_FORBIDDEN", "Vault reveal is not allowed for this role.");
        }
        if (!rules.allowedRoles().isEmpty() && !rules.allowedRoles().contains(member.getRole().name())) {
            throw new AppException(HttpStatus.FORBIDDEN, "VAULT_ROLE_FORBIDDEN", "Vault reveal is not allowed for this role.");
        }
        if (!secret.isCredentialReady()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "SECRET_NOT_READY", "Secret is not ready.");
        }

        VaultAccessRequestEntity approvedRequest = null;
        if (rules.requireApproval()) {
            approvedRequest = requireApprovedAccessRequest(secretId, principal.getUserId(), principal.getTenantId());
        }

        long viewedCount = accessEventRepository.countBySecretIdAndViewerUserIdAndTenantIdAndDeletedAtIsNull(
                secretId,
                principal.getUserId(),
                principal.getTenantId()
        );
        if (rules.oneTimeView() && viewedCount > 0) {
            throw new AppException(HttpStatus.FORBIDDEN, "VAULT_ONE_TIME_VIEW_EXHAUSTED", "This secret can be viewed only once.");
        }
        if (rules.maxViews() != null && viewedCount >= rules.maxViews()) {
            throw new AppException(HttpStatus.FORBIDDEN, "VAULT_MAX_VIEW_EXCEEDED", "Maximum reveal count is exceeded.");
        }

        String plainText = vaultCryptoService.decrypt(secret.getSecretCiphertext(), secret.getNonce());
        recordRevealEvent(secretId, principal.getTenantId(), principal.getUserId());

        if (approvedRequest != null && rules.oneTimeView()) {
            approvedRequest.setStatus(VaultAccessRequestStatus.EXPIRED);
            approvedRequest.setExpiresAt(OffsetDateTime.now());
            approvedRequest.setUpdatedBy(principal.getUserId());
            accessRequestRepository.save(approvedRequest);
        }

        outboxService.publish(principal.getTenantId(), principal.getUserId(), "vault_secret", secretId,
                "vault.secret.revealed", "Vault secret revealed", secret.getName(), Map.of("secretId", secretId));
        return ApiSuccess.of(Map.of("secret", plainText, "version", secret.getVersion()));
    }

    private VaultAccessRequestEntity requireApprovedAccessRequest(UUID secretId, UUID requesterUserId, UUID tenantId) {
        VaultAccessRequestEntity request = accessRequestRepository
                .findTopBySecretIdAndRequesterUserIdAndTenantIdAndDeletedAtIsNullOrderByCreatedAtDesc(secretId, requesterUserId, tenantId)
                .orElseThrow(() -> new AppException(HttpStatus.FORBIDDEN, "VAULT_ACCESS_NOT_APPROVED", "Approved access request is required."));
        if (request.getStatus() != VaultAccessRequestStatus.APPROVED) {
            throw new AppException(HttpStatus.FORBIDDEN, "VAULT_ACCESS_NOT_APPROVED", "Approved access request is required.");
        }
        if (request.getExpiresAt() != null && request.getExpiresAt().isBefore(OffsetDateTime.now())) {
            request.setStatus(VaultAccessRequestStatus.EXPIRED);
            request.setUpdatedBy(requesterUserId);
            accessRequestRepository.save(request);
            throw new AppException(HttpStatus.FORBIDDEN, "VAULT_ACCESS_EXPIRED", "Approved access request is expired.");
        }
        return request;
    }

    private void recordRevealEvent(UUID secretId, UUID tenantId, UUID viewerUserId) {
        VaultAccessEventEntity event = new VaultAccessEventEntity();
        event.setTenantId(tenantId);
        event.setSecretId(secretId);
        event.setViewerUserId(viewerUserId);
        event.setEventType("VIEWED");
        event.setCreatedBy(viewerUserId);
        event.setUpdatedBy(viewerUserId);
        accessEventRepository.save(event);
    }

    private VaultRules resolveVaultRules(UUID projectId, UUID tenantId) {
        Optional<VaultPolicyEntity> policy = policyRepository.findTopByProjectIdAndTenantIdAndDeletedAtIsNullOrderByCreatedAtDesc(projectId, tenantId);
        if (policy.isEmpty()) {
            return VaultRules.defaultRules();
        }
        return parseRules(policy.get().getRuleJson());
    }

    private VaultRules parseRules(String raw) {
        if (raw == null || raw.isBlank()) {
            return VaultRules.defaultRules();
        }
        try {
            JsonNode node = objectMapper.readTree(raw);
            boolean requireApproval = node.path("requireApproval").asBoolean(true);
            boolean oneTimeView = node.path("oneTimeView").asBoolean(false);
            int viewTtlMinutes = Math.max(1, node.path("viewTtlMinutes").asInt(DEFAULT_VIEW_TTL_MINUTES));
            Integer maxViews = node.hasNonNull("maxViews") ? Math.max(1, node.path("maxViews").asInt(1)) : null;
            String visibility = node.path("visibility").asText("");
            boolean clientAllowed = !"PM_ONLY".equalsIgnoreCase(visibility);
            Set<String> allowedRoles = extractAllowedRoles(node.path("allowedRoles"));
            return new VaultRules(requireApproval, oneTimeView, viewTtlMinutes, maxViews, clientAllowed, allowedRoles);
        } catch (Exception ignored) {
            return VaultRules.defaultRules();
        }
    }

    private Set<String> extractAllowedRoles(JsonNode node) {
        if (node == null || !node.isArray() || node.isEmpty()) {
            return Set.of();
        }
        var result = new java.util.HashSet<String>();
        node.forEach(value -> {
            if (value != null && value.isTextual()) {
                String role = value.asText().trim();
                if (!role.isEmpty()) {
                    result.add(role);
                }
            }
        });
        return Set.copyOf(result);
    }

    private boolean isClientRole(MemberRole role) {
        return role == MemberRole.CLIENT_OWNER || role == MemberRole.CLIENT_MEMBER;
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
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "SECRET_NOT_FOUND", "Secret not found."));
        if (secret.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "SECRET_NOT_FOUND", "Secret not found.");
        }
        return secret;
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

    private record VaultRules(boolean requireApproval,
                              boolean oneTimeView,
                              int viewTtlMinutes,
                              Integer maxViews,
                              boolean clientAllowed,
                              Set<String> allowedRoles) {
        private static VaultRules defaultRules() {
            return new VaultRules(true, false, DEFAULT_VIEW_TTL_MINUTES, null, true, Set.of());
        }
    }
}
