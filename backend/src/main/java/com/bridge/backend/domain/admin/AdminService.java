package com.bridge.backend.domain.admin;

import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.MemberRole;
import com.bridge.backend.common.model.enums.UserStatus;
import com.bridge.backend.domain.auth.UserEntity;
import com.bridge.backend.domain.auth.UserRepository;
import com.bridge.backend.domain.project.ProjectEntity;
import com.bridge.backend.domain.project.ProjectMemberEntity;
import com.bridge.backend.domain.project.ProjectMemberRepository;
import com.bridge.backend.domain.project.ProjectRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class AdminService {
    private static final String SETUP_CODE_DIGITS = "0123456789";
    private static final int SETUP_CODE_LENGTH = 8;
    private static final int SETUP_CODE_TTL_HOURS = 24;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final TenantRepository tenantRepository;
    private final TenantMemberRepository tenantMemberRepository;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectRepository projectRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminService(TenantRepository tenantRepository,
                        TenantMemberRepository tenantMemberRepository,
                        UserRepository userRepository,
                        ProjectMemberRepository projectMemberRepository,
                        ProjectRepository projectRepository,
                        PasswordEncoder passwordEncoder) {
        this.tenantRepository = tenantRepository;
        this.tenantMemberRepository = tenantMemberRepository;
        this.userRepository = userRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.projectRepository = projectRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public record SetupCodeIssueResult(UUID userId,
                                       String email,
                                       UserStatus status,
                                       boolean passwordInitialized,
                                       String setupCode,
                                       OffsetDateTime setupCodeExpiresAt) {
    }

    @Transactional
    public TenantEntity createTenant(String name, String slug, UUID actorId) {
        tenantRepository.findBySlug(slug).ifPresent(t -> {
            throw new AppException(HttpStatus.CONFLICT, "TENANT_SLUG_DUPLICATE", "이미 사용 중인 slug 입니다.");
        });
        TenantEntity tenant = new TenantEntity();
        tenant.setName(name);
        tenant.setSlug(slug);
        tenant.setCreatedBy(actorId);
        tenant.setUpdatedBy(actorId);
        return tenantRepository.save(tenant);
    }

    @Transactional(readOnly = true)
    public List<TenantEntity> listTenants() {
        return tenantRepository.findAll().stream()
                .filter(tenant -> tenant.getDeletedAt() == null)
                .sorted(Comparator.comparing(TenantEntity::getCreatedAt).reversed())
                .toList();
    }

    @Transactional(readOnly = true)
    public TenantEntity getTenant(UUID tenantId) {
        return tenantRepository.findById(tenantId)
                .filter(tenant -> tenant.getDeletedAt() == null)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "TENANT_NOT_FOUND", "테넌트를 찾을 수 없습니다."));
    }

    @Transactional
    public SetupCodeIssueResult createTenantUser(UUID tenantId, String email, String name, MemberRole role, UUID actorId) {
        getTenant(tenantId);
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);

        UserEntity user = userRepository.findByEmailAndDeletedAtIsNull(normalizedEmail).orElseGet(() -> {
            UserEntity created = new UserEntity();
            created.setEmail(normalizedEmail);
            created.setName(name);
            created.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
            created.setStatus(UserStatus.INVITED);
            created.setPasswordInitialized(false);
            created.setFailedLoginAttempts(0);
            created.setCreatedBy(actorId);
            created.setUpdatedBy(actorId);
            return userRepository.save(created);
        });

        String setupCode = null;
        OffsetDateTime setupCodeExpiresAt = null;
        if (!user.isPasswordInitialized()) {
            setupCode = generateSetupCode();
            setupCodeExpiresAt = OffsetDateTime.now().plusHours(SETUP_CODE_TTL_HOURS);
            user.setPasswordSetupCodeHash(sha256(setupCode));
            user.setPasswordSetupCodeExpiresAt(setupCodeExpiresAt);
            user.setUpdatedBy(actorId);
            user = userRepository.save(user);
        }
        UUID userId = user.getId();

        Optional<TenantMemberEntity> existingMember = tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(tenantId, userId);
        TenantMemberEntity member = existingMember
                .orElseGet(() -> {
                    TenantMemberEntity created = new TenantMemberEntity();
                    created.setTenantId(tenantId);
                    created.setUserId(userId);
                    created.setCreatedBy(actorId);
                    return created;
                });
        MemberRole resolvedRole = existingMember
                .map(TenantMemberEntity::getRole)
                .orElse(MemberRole.PM_MEMBER);
        if (role != null) {
            resolvedRole = role;
        }
        member.setRole(resolvedRole);
        member.setUpdatedBy(actorId);
        tenantMemberRepository.save(member);

        syncProjectMembershipForSingleProjectTenant(tenantId, userId, resolvedRole, actorId);

        return new SetupCodeIssueResult(
                userId,
                user.getEmail(),
                user.getStatus(),
                user.isPasswordInitialized(),
                setupCode,
                setupCodeExpiresAt
        );
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listTenantUsers(UUID tenantId) {
        getTenant(tenantId);

        return tenantMemberRepository.findByTenantIdAndDeletedAtIsNull(tenantId).stream()
                .map(member -> {
                    UserEntity user = requireActiveUser(member.getUserId());
                    Map<String, Object> row = new HashMap<>();
                    row.put("userId", user.getId());
                    row.put("email", user.getEmail());
                    row.put("name", user.getName());
                    row.put("status", user.getStatus());
                    row.put("role", member.getRole());
                    row.put("lastLoginAt", user.getLastLoginAt());
                    row.put("passwordInitialized", user.isPasswordInitialized());
                    return row;
                })
                .sorted(Comparator.comparing(row -> String.valueOf(row.get("email"))))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ProjectEntity> listProjects(UUID tenantId) {
        getTenant(tenantId);
        return projectRepository.findByTenantIdAndDeletedAtIsNull(tenantId).stream()
                .sorted(Comparator.comparing(ProjectEntity::getCreatedAt).reversed())
                .toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getUserDetail(UUID userId) {
        UserEntity user = requireActiveUser(userId);

        List<TenantMemberEntity> memberships = tenantMemberRepository.findByUserIdAndDeletedAtIsNull(userId);
        Map<UUID, TenantEntity> tenantsById = tenantRepository.findAllById(
                        memberships.stream().map(TenantMemberEntity::getTenantId).collect(Collectors.toSet()))
                .stream()
                .filter(tenant -> tenant.getDeletedAt() == null)
                .collect(Collectors.toMap(TenantEntity::getId, Function.identity()));

        List<Map<String, Object>> tenantMemberships = memberships.stream()
                .filter(member -> tenantsById.containsKey(member.getTenantId()))
                .map(member -> {
                    TenantEntity tenant = tenantsById.get(member.getTenantId());
                    return Map.<String, Object>of(
                            "tenantId", tenant.getId(),
                            "tenantName", tenant.getName(),
                            "tenantSlug", tenant.getSlug(),
                            "role", member.getRole().name()
                    );
                })
                .sorted(Comparator.comparing(row -> String.valueOf(row.get("tenantName"))))
                .toList();

        Map<String, Object> detail = new HashMap<>();
        detail.put("userId", user.getId());
        detail.put("email", user.getEmail());
        detail.put("name", user.getName());
        detail.put("status", user.getStatus());
        detail.put("isPlatformAdmin", user.isPlatformAdmin());
        detail.put("lastLoginAt", user.getLastLoginAt());
        detail.put("failedLoginAttempts", user.getFailedLoginAttempts());
        detail.put("loginBlocked", user.getFailedLoginAttempts() >= 5);
        detail.put("passwordInitialized", user.isPasswordInitialized());
        detail.put("memberships", tenantMemberships);
        return detail;
    }

    @Transactional
    public UserEntity updateUserStatus(UUID userId, UserStatus status) {
        UserEntity user = requireActiveUser(userId);
        user.setStatus(status);
        return userRepository.save(user);
    }

    @Transactional
    public Map<String, Object> unlockLogin(UUID userId) {
        UserEntity user = requireActiveUser(userId);
        user.setFailedLoginAttempts(0);
        userRepository.save(user);
        return Map.of(
                "userId", user.getId(),
                "loginBlocked", false,
                "failedLoginAttempts", 0
        );
    }

    @Transactional
    public SetupCodeIssueResult resetSetupCode(UUID userId, UUID actorId) {
        UserEntity user = requireActiveUser(userId);
        if (user.isPasswordInitialized()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "PASSWORD_ALREADY_INITIALIZED", "Password already initialized.");
        }

        String setupCode = generateSetupCode();
        OffsetDateTime setupCodeExpiresAt = OffsetDateTime.now().plusHours(SETUP_CODE_TTL_HOURS);
        user.setPasswordSetupCodeHash(sha256(setupCode));
        user.setPasswordSetupCodeExpiresAt(setupCodeExpiresAt);
        user.setUpdatedBy(actorId);
        userRepository.save(user);

        return new SetupCodeIssueResult(
                user.getId(),
                user.getEmail(),
                user.getStatus(),
                user.isPasswordInitialized(),
                setupCode,
                setupCodeExpiresAt
        );
    }

    private String generateSetupCode() {
        StringBuilder builder = new StringBuilder(SETUP_CODE_LENGTH);
        for (int i = 0; i < SETUP_CODE_LENGTH; i++) {
            int index = SECURE_RANDOM.nextInt(SETUP_CODE_DIGITS.length());
            builder.append(SETUP_CODE_DIGITS.charAt(index));
        }
        return builder.toString();
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return Base64.getEncoder().encodeToString(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private UserEntity requireActiveUser(UUID userId) {
        return userRepository.findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다."));
    }

    private void syncProjectMembershipForSingleProjectTenant(UUID tenantId, UUID userId, MemberRole role, UUID actorId) {
        List<ProjectEntity> projects = projectRepository.findByTenantIdAndDeletedAtIsNull(tenantId);
        if (projects.size() != 1) {
            return;
        }

        UUID projectId = projects.get(0).getId();
        ProjectMemberEntity projectMember = projectMemberRepository.findByProjectIdAndUserIdAndDeletedAtIsNull(projectId, userId)
                .orElseGet(() -> {
                    ProjectMemberEntity created = new ProjectMemberEntity();
                    created.setTenantId(tenantId);
                    created.setProjectId(projectId);
                    created.setUserId(userId);
                    created.setCreatedBy(actorId);
                    return created;
                });
        projectMember.setRole(role);
        projectMember.setUpdatedBy(actorId);
        projectMemberRepository.save(projectMember);
    }
}
