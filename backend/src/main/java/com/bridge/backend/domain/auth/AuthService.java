package com.bridge.backend.domain.auth;

import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.UserStatus;
import com.bridge.backend.common.security.JwtService;
import com.bridge.backend.domain.admin.TenantEntity;
import com.bridge.backend.domain.admin.TenantMemberEntity;
import com.bridge.backend.domain.admin.TenantMemberRepository;
import com.bridge.backend.domain.admin.TenantRepository;
import com.bridge.backend.domain.project.InvitationEntity;
import com.bridge.backend.domain.project.InvitationRepository;
import com.bridge.backend.domain.project.ProjectMemberEntity;
import com.bridge.backend.domain.project.ProjectMemberRepository;
import io.jsonwebtoken.Claims;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class AuthService {
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final TenantMemberRepository tenantMemberRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final InvitationRepository invitationRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final Map<String, Integer> failedLoginAttempts = new ConcurrentHashMap<>();

    public AuthService(UserRepository userRepository,
                       TenantRepository tenantRepository,
                       TenantMemberRepository tenantMemberRepository,
                       ProjectMemberRepository projectMemberRepository,
                       InvitationRepository invitationRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.tenantMemberRepository = tenantMemberRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.invitationRepository = invitationRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public Map<String, Object> login(String email, String password, String tenantSlug) {
        String key = email.toLowerCase(Locale.ROOT);
        int failCount = failedLoginAttempts.getOrDefault(key, 0);
        if (failCount >= MAX_FAILED_ATTEMPTS) {
            throw new AppException(HttpStatus.TOO_MANY_REQUESTS, "LOGIN_BLOCKED", "Too many login attempts.");
        }

        UserEntity user = userRepository.findByEmailAndDeletedAtIsNull(email)
                .orElseThrow(() -> invalidCredentials(key));

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw invalidCredentials(key);
        }
        if (user.getStatus() == UserStatus.SUSPENDED || user.getStatus() == UserStatus.DEACTIVATED) {
            throw new AppException(HttpStatus.FORBIDDEN, "USER_BLOCKED", "User is blocked.");
        }

        failedLoginAttempts.remove(key);

        if (user.isPlatformAdmin()) {
            return loginAsPlatformAdmin(user, tenantSlug);
        }

        List<TenantMemberEntity> memberships = tenantMemberRepository.findByUserIdAndDeletedAtIsNull(user.getId());
        if (memberships.isEmpty()) {
            throw new AppException(HttpStatus.FORBIDDEN, "TENANT_ACCESS_DENIED", "No tenant access.");
        }

        Map<UUID, TenantEntity> tenantsById = tenantRepository.findAllById(
                        memberships.stream().map(TenantMemberEntity::getTenantId).collect(Collectors.toSet()))
                .stream()
                .filter(tenant -> tenant.getDeletedAt() == null)
                .collect(Collectors.toMap(TenantEntity::getId, Function.identity()));

        List<TenantMemberEntity> activeMemberships = memberships.stream()
                .filter(member -> tenantsById.containsKey(member.getTenantId()))
                .collect(Collectors.toList());
        if (activeMemberships.isEmpty()) {
            throw new AppException(HttpStatus.FORBIDDEN, "TENANT_ACCESS_DENIED", "No tenant access.");
        }

        if (tenantSlug != null && !tenantSlug.isBlank()) {
            TenantEntity tenant = tenantRepository.findBySlug(tenantSlug)
                    .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "TENANT_NOT_FOUND", "Tenant not found."));
            TenantMemberEntity tenantMember = activeMemberships.stream()
                    .filter(member -> member.getTenantId().equals(tenant.getId()))
                    .findFirst()
                    .orElseThrow(() -> new AppException(HttpStatus.FORBIDDEN, "TENANT_ACCESS_DENIED", "No tenant access."));
            return issueTokens(user, tenant, tenantMember);
        }

        if (activeMemberships.size() == 1) {
            TenantMemberEntity tenantMember = activeMemberships.get(0);
            TenantEntity tenant = tenantsById.get(tenantMember.getTenantId());
            return issueTokens(user, tenant, tenantMember);
        }

        List<Map<String, Object>> tenantOptions = activeMemberships.stream()
                .map(member -> {
                    TenantEntity tenant = tenantsById.get(member.getTenantId());
                    return Map.<String, Object>of(
                            "tenantId", tenant.getId(),
                            "tenantSlug", tenant.getSlug(),
                            "tenantName", tenant.getName(),
                            "role", member.getRole().name()
                    );
                })
                .sorted(Comparator.comparing(option -> String.valueOf(option.get("tenantName"))))
                .collect(Collectors.toList());

        return Map.of(
                "requiresTenantSelection", true,
                "tenantOptions", tenantOptions
        );
    }

    private Map<String, Object> loginAsPlatformAdmin(UserEntity user, String tenantSlug) {
        List<TenantEntity> activeTenants = tenantRepository.findAll().stream()
                .filter(tenant -> tenant.getDeletedAt() == null)
                .sorted(Comparator.comparing(TenantEntity::getName))
                .toList();
        if (activeTenants.isEmpty()) {
            throw new AppException(HttpStatus.NOT_FOUND, "TENANT_NOT_FOUND", "Tenant not found.");
        }

        if (tenantSlug != null && !tenantSlug.isBlank()) {
            TenantEntity tenant = tenantRepository.findBySlug(tenantSlug)
                    .filter(found -> found.getDeletedAt() == null)
                    .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "TENANT_NOT_FOUND", "Tenant not found."));
            return issuePlatformAdminTokens(user, tenant);
        }

        if (activeTenants.size() == 1) {
            return issuePlatformAdminTokens(user, activeTenants.get(0));
        }

        List<Map<String, Object>> tenantOptions = activeTenants.stream()
                .map(tenant -> Map.<String, Object>of(
                        "tenantId", tenant.getId(),
                        "tenantSlug", tenant.getSlug(),
                        "tenantName", tenant.getName(),
                        "role", "PLATFORM_ADMIN"
                ))
                .toList();

        return Map.of(
                "requiresTenantSelection", true,
                "tenantOptions", tenantOptions
        );
    }

    private Map<String, Object> issueTokens(UserEntity user, TenantEntity tenant, TenantMemberEntity tenantMember) {
        Set<String> roles = projectMemberRepository.findByUserIdAndTenantIdAndDeletedAtIsNull(user.getId(), tenant.getId())
                .stream()
                .map(member -> member.getRole().name())
                .collect(Collectors.toSet());
        roles.add("TENANT_" + tenantMember.getRole().name());
        if (user.isPlatformAdmin()) {
            roles.add("PLATFORM_ADMIN");
        }

        return issueTokensWithRoles(user, tenant.getId(), roles);
    }

    private Map<String, Object> issuePlatformAdminTokens(UserEntity user, TenantEntity tenant) {
        Set<String> roles = projectMemberRepository.findByUserIdAndTenantIdAndDeletedAtIsNull(user.getId(), tenant.getId())
                .stream()
                .map(member -> member.getRole().name())
                .collect(Collectors.toSet());
        roles.add("PLATFORM_ADMIN");
        tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(tenant.getId(), user.getId())
                .ifPresent(member -> roles.add("TENANT_" + member.getRole().name()));

        return issueTokensWithRoles(user, tenant.getId(), roles);
    }

    private Map<String, Object> issueTokensWithRoles(UserEntity user, UUID tenantId, Set<String> roles) {
        String accessToken = jwtService.issueAccessToken(user.getId(), tenantId, roles);
        String refreshToken = jwtService.issueRefreshToken(user.getId(), tenantId);

        RefreshTokenEntity entity = new RefreshTokenEntity();
        entity.setTenantId(tenantId);
        entity.setUserId(user.getId());
        entity.setTokenHash(sha256(refreshToken));
        entity.setExpiresAt(OffsetDateTime.now().plusDays(30));
        refreshTokenRepository.save(entity);

        user.setLastLoginAt(OffsetDateTime.now());
        user.setStatus(UserStatus.ACTIVE);
        userRepository.save(user);

        return Map.of(
                "accessToken", accessToken,
                "refreshToken", refreshToken,
                "userId", user.getId(),
                "tenantId", tenantId,
                "roles", roles
        );
    }

    @Transactional
    public Map<String, Object> refresh(String refreshToken) {
        Claims claims = jwtService.parse(refreshToken);
        if (!jwtService.isRefreshToken(claims)) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "INVALID_TOKEN", "Invalid refresh token.");
        }
        String hash = sha256(refreshToken);
        RefreshTokenEntity saved = refreshTokenRepository.findByTokenHashAndRevokedAtIsNull(hash)
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "REFRESH_REVOKED", "Refresh token revoked."));
        if (saved.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "REFRESH_EXPIRED", "Refresh token expired.");
        }

        UUID userId = UUID.fromString(claims.getSubject());
        UUID tenantId = UUID.fromString(claims.get("tenantId", String.class));
        Set<String> roles = projectMemberRepository.findByUserIdAndTenantIdAndDeletedAtIsNull(userId, tenantId)
                .stream()
                .map(member -> member.getRole().name())
                .collect(Collectors.toSet());
        UserEntity user = userRepository.findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "USER_NOT_FOUND", "User not found."));
        tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(tenantId, userId)
                .ifPresent(member -> roles.add("TENANT_" + member.getRole().name()));
        if (user.isPlatformAdmin()) {
            roles.add("PLATFORM_ADMIN");
        }

        String accessToken = jwtService.issueAccessToken(userId, tenantId, roles);
        String newRefresh = jwtService.issueRefreshToken(userId, tenantId);
        saved.setRevokedAt(OffsetDateTime.now());
        refreshTokenRepository.save(saved);

        RefreshTokenEntity next = new RefreshTokenEntity();
        next.setTenantId(tenantId);
        next.setUserId(userId);
        next.setTokenHash(sha256(newRefresh));
        next.setExpiresAt(OffsetDateTime.now().plusDays(30));
        refreshTokenRepository.save(next);

        return Map.of("accessToken", accessToken, "refreshToken", newRefresh);
    }

    @Transactional
    public void logout(String refreshToken) {
        refreshTokenRepository.findByTokenHashAndRevokedAtIsNull(sha256(refreshToken))
                .ifPresent(token -> {
                    token.setRevokedAt(OffsetDateTime.now());
                    refreshTokenRepository.save(token);
                });
    }

    @Transactional
    public Map<String, Object> switchTenant(UUID userId, UUID tenantId) {
        UserEntity user = userRepository.findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "USER_NOT_FOUND", "User not found."));
        TenantEntity tenant = tenantRepository.findById(tenantId)
                .filter(found -> found.getDeletedAt() == null)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "TENANT_NOT_FOUND", "Tenant not found."));

        if (user.isPlatformAdmin()) {
            return issuePlatformAdminTokens(user, tenant);
        }

        TenantMemberEntity tenantMember = tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(tenantId, userId)
                .orElseThrow(() -> new AppException(HttpStatus.FORBIDDEN, "TENANT_ACCESS_DENIED", "No tenant access."));
        return issueTokens(user, tenant, tenantMember);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> me(UUID userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found."));
        return Map.of(
                "id", user.getId(),
                "email", user.getEmail(),
                "name", user.getName(),
                "status", user.getStatus(),
                "isPlatformAdmin", user.isPlatformAdmin()
        );
    }

    @Transactional
    public void setPassword(UUID userId, String password) {
        UserEntity user = userRepository.findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found."));
        user.setPasswordHash(passwordEncoder.encode(password));
        if (user.getStatus() == UserStatus.INVITED) {
            user.setStatus(UserStatus.ACTIVE);
        }
        userRepository.save(user);
        failedLoginAttempts.remove(user.getEmail().toLowerCase(Locale.ROOT));
    }

    @Transactional
    public Map<String, Object> activateInvitation(String invitationToken, String password, String name) {
        InvitationEntity invitation = invitationRepository.findByInvitationTokenAndDeletedAtIsNull(invitationToken)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "INVITATION_NOT_FOUND", "Invitation token not found."));
        if (invitation.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVITATION_EXPIRED", "Invitation is expired.");
        }

        String invitedEmail = invitation.getInvitedEmail().trim().toLowerCase(Locale.ROOT);
        String defaultName = invitedEmail.split("@")[0];
        String resolvedName = (name == null || name.isBlank()) ? defaultName : name.trim();
        UUID invitationCreatorId = invitation.getCreatedBy();

        UserEntity user = userRepository.findByEmailAndDeletedAtIsNull(invitedEmail).orElseGet(() -> {
            UserEntity created = new UserEntity();
            created.setEmail(invitedEmail);
            created.setName(resolvedName);
            created.setStatus(UserStatus.ACTIVE);
            created.setCreatedBy(invitationCreatorId);
            created.setUpdatedBy(invitationCreatorId);
            return created;
        });
        user.setEmail(invitedEmail);
        if (user.getName() == null || user.getName().isBlank() || (name != null && !name.isBlank())) {
            user.setName(resolvedName);
        }
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setStatus(UserStatus.ACTIVE);
        user.setUpdatedBy(invitationCreatorId);
        user = userRepository.save(user);
        UUID auditUserId = invitationCreatorId != null ? invitationCreatorId : user.getId();
        if (user.getCreatedBy() == null || user.getUpdatedBy() == null) {
            user.setCreatedBy(user.getCreatedBy() == null ? auditUserId : user.getCreatedBy());
            user.setUpdatedBy(auditUserId);
            user = userRepository.save(user);
        }
        UUID activatedUserId = user.getId();

        TenantMemberEntity tenantMember = tenantMemberRepository
                .findByTenantIdAndUserIdAndDeletedAtIsNull(invitation.getTenantId(), activatedUserId)
                .orElseGet(() -> {
                    TenantMemberEntity created = new TenantMemberEntity();
                    created.setTenantId(invitation.getTenantId());
                    created.setUserId(activatedUserId);
                    created.setRole(invitation.getRole());
                    created.setCreatedBy(auditUserId);
                    created.setUpdatedBy(auditUserId);
                    return created;
                });
        tenantMember.setRole(invitation.getRole());
        tenantMember.setUpdatedBy(auditUserId);
        tenantMember = tenantMemberRepository.save(tenantMember);

        if (projectMemberRepository.findByProjectIdAndUserIdAndDeletedAtIsNull(invitation.getProjectId(), activatedUserId).isEmpty()) {
            ProjectMemberEntity member = new ProjectMemberEntity();
            member.setTenantId(invitation.getTenantId());
            member.setProjectId(invitation.getProjectId());
            member.setUserId(activatedUserId);
            member.setRole(invitation.getRole());
            member.setCreatedBy(auditUserId);
            member.setUpdatedBy(auditUserId);
            projectMemberRepository.save(member);
        }

        if (invitation.getAcceptedAt() == null) {
            invitation.setAcceptedAt(OffsetDateTime.now());
            invitation.setUpdatedBy(auditUserId);
            invitationRepository.save(invitation);
        }

        TenantEntity tenant = tenantRepository.findById(invitation.getTenantId())
                .filter(found -> found.getDeletedAt() == null)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "TENANT_NOT_FOUND", "Tenant not found."));
        Map<String, Object> tokens = issueTokens(user, tenant, tenantMember);

        return Map.ofEntries(
                Map.entry("accepted", true),
                Map.entry("projectId", invitation.getProjectId()),
                Map.entry("tenantId", invitation.getTenantId()),
                Map.entry("invitedEmail", invitation.getInvitedEmail()),
                Map.entry("accessToken", tokens.get("accessToken")),
                Map.entry("refreshToken", tokens.get("refreshToken")),
                Map.entry("userId", tokens.get("userId")),
                Map.entry("roles", tokens.get("roles"))
        );
    }

    private AppException invalidCredentials(String key) {
        failedLoginAttempts.put(key, failedLoginAttempts.getOrDefault(key, 0) + 1);
        return new AppException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid email or password.");
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return Base64.getEncoder().encodeToString(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}
