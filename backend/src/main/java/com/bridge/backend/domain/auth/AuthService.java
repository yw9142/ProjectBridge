package com.bridge.backend.domain.auth;

import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.UserStatus;
import com.bridge.backend.common.security.JwtService;
import com.bridge.backend.domain.admin.TenantEntity;
import com.bridge.backend.domain.admin.TenantMemberEntity;
import com.bridge.backend.domain.admin.TenantMemberRepository;
import com.bridge.backend.domain.admin.TenantRepository;
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
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class AuthService {
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int MIN_PASSWORD_LENGTH = 10;
    private static final int MAX_PASSWORD_LENGTH = 72;
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final TenantMemberRepository tenantMemberRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository,
                       TenantRepository tenantRepository,
                       TenantMemberRepository tenantMemberRepository,
                       ProjectMemberRepository projectMemberRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.tenantMemberRepository = tenantMemberRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public Map<String, Object> login(String email, String password, String tenantSlug) {
        String normalizedEmail = normalizeEmail(email);

        UserEntity user = userRepository.findByEmailAndDeletedAtIsNull(normalizedEmail)
                .orElseThrow(this::invalidCredentials);

        if (user.getFailedLoginAttempts() >= MAX_FAILED_ATTEMPTS) {
            throw new AppException(HttpStatus.TOO_MANY_REQUESTS, "LOGIN_BLOCKED", "Too many login attempts.");
        }
        if (user.getStatus() == UserStatus.SUSPENDED || user.getStatus() == UserStatus.DEACTIVATED) {
            throw new AppException(HttpStatus.FORBIDDEN, "USER_BLOCKED", "User is blocked.");
        }
        if (!user.isPasswordInitialized()) {
            throw new AppException(
                    HttpStatus.FORBIDDEN,
                    "PASSWORD_SETUP_REQUIRED",
                    "First password setup is required.",
                    Map.of("email", user.getEmail())
            );
        }
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            int nextAttempts = user.getFailedLoginAttempts() + 1;
            user.setFailedLoginAttempts(nextAttempts);
            userRepository.save(user);
            if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
                throw new AppException(HttpStatus.TOO_MANY_REQUESTS, "LOGIN_BLOCKED", "Too many login attempts.");
            }
            throw invalidCredentials();
        }

        user.setFailedLoginAttempts(0);

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
        user.setFailedLoginAttempts(0);
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
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "REFRESH_MISSING", "Refresh token missing.");
        }
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
        if (user.getStatus() == UserStatus.SUSPENDED || user.getStatus() == UserStatus.DEACTIVATED) {
            throw new AppException(HttpStatus.FORBIDDEN, "USER_BLOCKED", "User is blocked.");
        }
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
    public Map<String, Object> setupFirstPassword(String email, String setupCode, String newPassword) {
        String normalizedEmail = normalizeEmail(email);
        UserEntity user = userRepository.findByEmailAndDeletedAtIsNull(normalizedEmail)
                .orElseThrow(() -> new AppException(HttpStatus.BAD_REQUEST, "PASSWORD_SETUP_CODE_INVALID", "Invalid password setup code."));
        if (user.isPasswordInitialized()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "PASSWORD_ALREADY_INITIALIZED", "Password already initialized.");
        }
        if (setupCode == null || setupCode.isBlank()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "PASSWORD_SETUP_CODE_INVALID", "Invalid password setup code.");
        }
        if (!isSetupCodeValid(user, setupCode)) {
            throw new AppException(HttpStatus.BAD_REQUEST, "PASSWORD_SETUP_CODE_INVALID", "Invalid password setup code.");
        }
        validatePasswordPolicy(newPassword);

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setPasswordInitialized(true);
        user.setPasswordSetupCodeHash(null);
        user.setPasswordSetupCodeExpiresAt(null);
        user.setFailedLoginAttempts(0);
        user.setStatus(UserStatus.ACTIVE);
        userRepository.save(user);

        return Map.of("passwordInitialized", true);
    }

    private boolean isSetupCodeValid(UserEntity user, String setupCode) {
        if (user.getPasswordSetupCodeHash() == null || user.getPasswordSetupCodeExpiresAt() == null) {
            return false;
        }
        if (user.getPasswordSetupCodeExpiresAt().isBefore(OffsetDateTime.now())) {
            return false;
        }
        return sha256(setupCode).equals(user.getPasswordSetupCodeHash());
    }

    private void validatePasswordPolicy(String password) {
        if (password == null || password.length() < MIN_PASSWORD_LENGTH || password.length() > MAX_PASSWORD_LENGTH) {
            throw new AppException(
                    HttpStatus.BAD_REQUEST,
                    "PASSWORD_POLICY_VIOLATION",
                    "Password must be 10-72 characters and include upper/lowercase letters and a number."
            );
        }
        boolean hasUpper = password.chars().anyMatch(Character::isUpperCase);
        boolean hasLower = password.chars().anyMatch(Character::isLowerCase);
        boolean hasDigit = password.chars().anyMatch(Character::isDigit);
        if (!hasUpper || !hasLower || !hasDigit) {
            throw new AppException(
                    HttpStatus.BAD_REQUEST,
                    "PASSWORD_POLICY_VIOLATION",
                    "Password must be 10-72 characters and include upper/lowercase letters and a number."
            );
        }
    }

    private AppException invalidCredentials() {
        return new AppException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid email or password.");
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
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
