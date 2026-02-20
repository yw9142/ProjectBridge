package com.bridge.backend.domain.project;

import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.MemberRole;
import com.bridge.backend.common.model.enums.ProjectStatus;
import com.bridge.backend.common.model.enums.UserStatus;
import com.bridge.backend.common.security.AuthPrincipal;
import com.bridge.backend.common.tenant.AccessGuardService;
import com.bridge.backend.domain.admin.TenantMemberEntity;
import com.bridge.backend.domain.admin.TenantMemberRepository;
import com.bridge.backend.domain.auth.UserEntity;
import com.bridge.backend.domain.auth.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class ProjectService {
    private static final String PASSWORD_MASK = "********";
    private static final Pattern SIMPLE_EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final String SETUP_CODE_DIGITS = "0123456789";
    private static final int SETUP_CODE_LENGTH = 8;
    private static final int SETUP_CODE_TTL_HOURS = 24;
    private static final int MIN_PASSWORD_LENGTH = 10;
    private static final int MAX_PASSWORD_LENGTH = 72;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final UserRepository userRepository;
    private final TenantMemberRepository tenantMemberRepository;
    private final PasswordEncoder passwordEncoder;
    private final AccessGuardService accessGuardService;

    public ProjectService(ProjectRepository projectRepository,
                          ProjectMemberRepository projectMemberRepository,
                          UserRepository userRepository,
                          TenantMemberRepository tenantMemberRepository,
                          PasswordEncoder passwordEncoder,
                          AccessGuardService accessGuardService) {
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.userRepository = userRepository;
        this.tenantMemberRepository = tenantMemberRepository;
        this.passwordEncoder = passwordEncoder;
        this.accessGuardService = accessGuardService;
    }

    public record ProjectMemberAccount(UUID id,
                                       UUID userId,
                                       MemberRole role,
                                       String loginId,
                                       String passwordMask,
                                       boolean passwordInitialized,
                                       String setupCode,
                                       OffsetDateTime setupCodeExpiresAt) {
    }

    @Transactional(readOnly = true)
    public List<ProjectEntity> list(AuthPrincipal principal) {
        UserEntity user = accessGuardService.requireUser(principal.getUserId());
        if (user.isPlatformAdmin()) {
            return projectRepository.findByTenantIdAndDeletedAtIsNull(principal.getTenantId());
        }

        List<UUID> projectIds = projectMemberRepository.findByUserIdAndTenantIdAndDeletedAtIsNull(principal.getUserId(), principal.getTenantId())
                .stream()
                .map(ProjectMemberEntity::getProjectId)
                .distinct()
                .toList();
        if (projectIds.isEmpty()) {
            return List.of();
        }
        return projectRepository.findByIdInAndTenantIdAndDeletedAtIsNull(projectIds, principal.getTenantId());
    }

    @Transactional
    public ProjectEntity create(AuthPrincipal principal, String name, String description) {
        accessGuardService.requireTenantMemberRole(
                principal.getTenantId(),
                principal.getUserId(),
                Set.of(MemberRole.PM_OWNER)
        );
        ProjectEntity project = new ProjectEntity();
        project.setTenantId(principal.getTenantId());
        project.setName(name);
        project.setDescription(description);
        project.setStatus(ProjectStatus.ACTIVE);
        project.setCreatedBy(principal.getUserId());
        project.setUpdatedBy(principal.getUserId());
        ProjectEntity saved = projectRepository.save(project);

        ProjectMemberEntity owner = new ProjectMemberEntity();
        owner.setTenantId(principal.getTenantId());
        owner.setProjectId(saved.getId());
        owner.setUserId(principal.getUserId());
        owner.setRole(MemberRole.PM_OWNER);
        owner.setCreatedBy(principal.getUserId());
        owner.setUpdatedBy(principal.getUserId());
        projectMemberRepository.save(owner);
        return saved;
    }

    @Transactional(readOnly = true)
    public ProjectEntity get(AuthPrincipal principal, UUID projectId) {
        accessGuardService.requireProjectMember(projectId, principal.getUserId(), principal.getTenantId());
        return accessGuardService.requireProjectInTenant(projectId, principal.getTenantId());
    }

    @Transactional(readOnly = true)
    public MemberRole myRole(AuthPrincipal principal, UUID projectId) {
        return accessGuardService.requireProjectMember(projectId, principal.getUserId(), principal.getTenantId()).getRole();
    }

    @Transactional
    public ProjectEntity update(AuthPrincipal principal, UUID projectId, String name, String description, ProjectStatus status) {
        accessGuardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        ProjectEntity project = accessGuardService.requireProjectInTenant(projectId, principal.getTenantId());
        if (name != null) {
            project.setName(name);
        }
        if (description != null) {
            project.setDescription(description);
        }
        if (status != null) {
            project.setStatus(status);
        }
        project.setUpdatedBy(principal.getUserId());
        return projectRepository.save(project);
    }

    @Transactional(readOnly = true)
    public List<ProjectMemberAccount> members(AuthPrincipal principal, UUID projectId) {
        accessGuardService.requireProjectMember(projectId, principal.getUserId(), principal.getTenantId());
        List<ProjectMemberEntity> projectMembers = projectMemberRepository.findByProjectIdAndDeletedAtIsNull(projectId);

        List<UUID> userIds = projectMembers.stream()
                .map(ProjectMemberEntity::getUserId)
                .distinct()
                .toList();

        Map<UUID, UserEntity> usersById = new HashMap<>();
        for (UserEntity user : userRepository.findAllById(userIds)) {
            if (user.getDeletedAt() == null) {
                usersById.put(user.getId(), user);
            }
        }

        List<ProjectMemberAccount> accounts = new ArrayList<>();
        for (ProjectMemberEntity member : projectMembers) {
            accounts.add(toProjectMemberAccount(member, usersById.get(member.getUserId()), null, null));
        }
        return accounts;
    }

    @Transactional
    public ProjectMemberAccount invite(AuthPrincipal principal,
                                       UUID projectId,
                                       String loginId,
                                       String name,
                                       MemberRole role) {
        accessGuardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER));
        MemberRole resolvedRole = role == null ? MemberRole.CLIENT_MEMBER : role;
        if (loginId == null || loginId.isBlank()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "MEMBER_ACCOUNT_REQUIRED", "Login id is required.");
        }

        String normalizedLoginId = loginId.trim().toLowerCase(Locale.ROOT);
        validateLoginId(normalizedLoginId);
        String setupCode = null;
        OffsetDateTime setupCodeExpiresAt = null;
        Optional<UserEntity> existingUserOpt = userRepository.findByEmailAndDeletedAtIsNull(normalizedLoginId);
        UserEntity savedUser = existingUserOpt.orElseGet(() -> {
            UserEntity entity = new UserEntity();
            entity.setEmail(normalizedLoginId);
            entity.setName((name == null || name.isBlank()) ? normalizedLoginId.split("@")[0] : name.trim());
            entity.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
            entity.setStatus(UserStatus.INVITED);
            entity.setPasswordInitialized(false);
            entity.setFailedLoginAttempts(0);
            entity.setCreatedBy(principal.getUserId());
            entity.setUpdatedBy(principal.getUserId());
            return userRepository.save(entity);
        });
        if (!savedUser.isPasswordInitialized()) {
            setupCode = generateSetupCode();
            setupCodeExpiresAt = OffsetDateTime.now().plusHours(SETUP_CODE_TTL_HOURS);
            savedUser.setPasswordSetupCodeHash(sha256(setupCode));
            savedUser.setPasswordSetupCodeExpiresAt(setupCodeExpiresAt);
            savedUser.setUpdatedBy(principal.getUserId());
            savedUser = userRepository.save(savedUser);
        }

        UUID savedUserId = savedUser.getId();
        TenantMemberEntity tenantMember = tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(principal.getTenantId(), savedUserId)
                .orElseGet(() -> {
                    TenantMemberEntity created = new TenantMemberEntity();
                    created.setTenantId(principal.getTenantId());
                    created.setUserId(savedUserId);
                    created.setCreatedBy(principal.getUserId());
                    return created;
                });
        tenantMember.setRole(resolvedRole);
        tenantMember.setUpdatedBy(principal.getUserId());
        tenantMemberRepository.save(tenantMember);

        ProjectMemberEntity member = projectMemberRepository.findByProjectIdAndUserIdAndDeletedAtIsNull(projectId, savedUserId)
                .orElseGet(() -> {
                    ProjectMemberEntity created = new ProjectMemberEntity();
                    created.setTenantId(principal.getTenantId());
                    created.setProjectId(projectId);
                    created.setUserId(savedUserId);
                    created.setRole(resolvedRole);
                    created.setCreatedBy(principal.getUserId());
                    created.setUpdatedBy(principal.getUserId());
                    return created;
                });
        member.setRole(resolvedRole);
        member.setUpdatedBy(principal.getUserId());
        ProjectMemberEntity savedMember = projectMemberRepository.save(member);
        if (savedMember.getCreatedBy() == null) {
            savedMember.setCreatedBy(principal.getUserId());
            savedMember.setUpdatedBy(principal.getUserId());
            savedMember = projectMemberRepository.save(savedMember);
        }
        syncTenantMembershipForSingleProjectTenant(
                principal.getTenantId(),
                projectId,
                savedUserId,
                resolvedRole,
                principal.getUserId()
        );
        return toProjectMemberAccount(savedMember, savedUser, setupCode, setupCodeExpiresAt);
    }

    @Transactional
    public ProjectMemberAccount resetSetupCode(AuthPrincipal principal, UUID projectId, UUID memberId) {
        accessGuardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER));
        ProjectMemberEntity member = projectMemberRepository.findById(memberId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "프로젝트 멤버를 찾을 수 없습니다."));
        if (member.getDeletedAt() != null || !member.getProjectId().equals(projectId)) {
            throw new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "프로젝트 멤버를 찾을 수 없습니다.");
        }

        UserEntity user = userRepository.findByIdAndDeletedAtIsNull(member.getUserId())
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다."));
        if (user.isPasswordInitialized()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "PASSWORD_ALREADY_INITIALIZED", "Password already initialized.");
        }

        String setupCode = generateSetupCode();
        OffsetDateTime setupCodeExpiresAt = OffsetDateTime.now().plusHours(SETUP_CODE_TTL_HOURS);
        user.setPasswordSetupCodeHash(sha256(setupCode));
        user.setPasswordSetupCodeExpiresAt(setupCodeExpiresAt);
        user.setUpdatedBy(principal.getUserId());
        UserEntity updated = userRepository.save(user);
        return toProjectMemberAccount(member, updated, setupCode, setupCodeExpiresAt);
    }

    @Transactional
    public ProjectMemberEntity updateMemberRole(AuthPrincipal principal, UUID projectId, UUID memberId, MemberRole role) {
        accessGuardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(), Set.of(MemberRole.PM_OWNER));
        ProjectMemberEntity member = projectMemberRepository.findById(memberId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "프로젝트 멤버를 찾을 수 없습니다."));
        if (member.getDeletedAt() != null || !member.getProjectId().equals(projectId)) {
            throw new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "프로젝트 멤버를 찾을 수 없습니다.");
        }
        member.setRole(role);
        member.setUpdatedBy(principal.getUserId());
        ProjectMemberEntity updatedMember = projectMemberRepository.save(member);
        syncTenantMembershipForSingleProjectTenant(
                principal.getTenantId(),
                projectId,
                member.getUserId(),
                role,
                principal.getUserId()
        );
        return updatedMember;
    }

    @Transactional
    public ProjectMemberAccount updateMemberAccount(AuthPrincipal principal,
                                                    UUID projectId,
                                                    UUID memberId,
                                                    String loginId,
                                                    String password) {
        accessGuardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(), Set.of(MemberRole.PM_OWNER));
        ProjectMemberEntity member = projectMemberRepository.findById(memberId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "프로젝트 멤버를 찾을 수 없습니다."));
        if (member.getDeletedAt() != null || !member.getProjectId().equals(projectId)) {
            throw new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "프로젝트 멤버를 찾을 수 없습니다.");
        }

        boolean hasLoginId = loginId != null && !loginId.isBlank();
        boolean hasPassword = password != null && !password.isBlank();
        if (!hasLoginId && !hasPassword) {
            throw new AppException(HttpStatus.BAD_REQUEST, "ACCOUNT_UPDATE_EMPTY", "로그인 ID 또는 비밀번호를 입력해주세요.");
        }

        UserEntity user = userRepository.findByIdAndDeletedAtIsNull(member.getUserId())
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다."));

        if (hasLoginId) {
            String normalizedLoginId = loginId.trim().toLowerCase(Locale.ROOT);
            validateLoginId(normalizedLoginId);
            userRepository.findByEmailAndDeletedAtIsNull(normalizedLoginId).ifPresent(existing -> {
                if (!existing.getId().equals(user.getId())) {
                    throw new AppException(HttpStatus.CONFLICT, "LOGIN_ID_DUPLICATE", "이미 존재하는 로그인 ID입니다.");
                }
            });
            user.setEmail(normalizedLoginId);
            if (user.getName() == null || user.getName().isBlank()) {
                user.setName(normalizedLoginId.split("@")[0]);
            }
        }

        if (hasPassword) {
            validatePasswordPolicy(password);
            user.setPasswordHash(passwordEncoder.encode(password));
            user.setStatus(UserStatus.ACTIVE);
            user.setPasswordInitialized(true);
            user.setPasswordSetupCodeHash(null);
            user.setPasswordSetupCodeExpiresAt(null);
            user.setFailedLoginAttempts(0);
        }

        user.setUpdatedBy(principal.getUserId());
        UserEntity updatedUser = userRepository.save(user);
        return toProjectMemberAccount(member, updatedUser, null, null);
    }

    @Transactional
    public Map<String, Object> removeMember(AuthPrincipal principal, UUID projectId, UUID memberId) {
        accessGuardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(), Set.of(MemberRole.PM_OWNER));
        ProjectMemberEntity member = projectMemberRepository.findById(memberId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "프로젝트 멤버를 찾을 수 없습니다."));
        if (member.getDeletedAt() != null || !member.getProjectId().equals(projectId)) {
            throw new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "프로젝트 멤버를 찾을 수 없습니다.");
        }
        if (member.getUserId().equals(principal.getUserId())) {
            throw new AppException(HttpStatus.BAD_REQUEST, "SELF_REMOVE_FORBIDDEN", "자신을 제거할 수 없습니다.");
        }
        member.setDeletedAt(OffsetDateTime.now());
        member.setUpdatedBy(principal.getUserId());
        projectMemberRepository.save(member);
        softDeleteTenantMembershipForSingleProjectTenant(
                principal.getTenantId(),
                projectId,
                member.getUserId(),
                principal.getUserId()
        );
        return Map.of("deleted", true);
    }

    private void syncTenantMembershipForSingleProjectTenant(UUID tenantId,
                                                            UUID projectId,
                                                            UUID userId,
                                                            MemberRole role,
                                                            UUID actorId) {
        if (!isSingleProjectTenant(tenantId, projectId)) {
            return;
        }
        TenantMemberEntity tenantMember = tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(tenantId, userId)
                .orElseGet(() -> {
                    TenantMemberEntity created = new TenantMemberEntity();
                    created.setTenantId(tenantId);
                    created.setUserId(userId);
                    created.setCreatedBy(actorId);
                    return created;
                });
        tenantMember.setRole(role);
        tenantMember.setUpdatedBy(actorId);
        tenantMemberRepository.save(tenantMember);
    }

    private void softDeleteTenantMembershipForSingleProjectTenant(UUID tenantId,
                                                                  UUID projectId,
                                                                  UUID userId,
                                                                  UUID actorId) {
        if (!isSingleProjectTenant(tenantId, projectId)) {
            return;
        }
        tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(tenantId, userId)
                .ifPresent(tenantMember -> {
                    tenantMember.setDeletedAt(OffsetDateTime.now());
                    tenantMember.setUpdatedBy(actorId);
                    tenantMemberRepository.save(tenantMember);
                });
    }

    private boolean isSingleProjectTenant(UUID tenantId, UUID projectId) {
        List<ProjectEntity> tenantProjects = projectRepository.findByTenantIdAndDeletedAtIsNull(tenantId);
        return tenantProjects.size() == 1 && tenantProjects.get(0).getId().equals(projectId);
    }

    private void validateLoginId(String loginId) {
        if (!SIMPLE_EMAIL_PATTERN.matcher(loginId).matches()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "LOGIN_ID_INVALID", "Login id must be a valid email address.");
        }
    }

    private String generateSetupCode() {
        StringBuilder builder = new StringBuilder(SETUP_CODE_LENGTH);
        for (int i = 0; i < SETUP_CODE_LENGTH; i++) {
            int index = SECURE_RANDOM.nextInt(SETUP_CODE_DIGITS.length());
            builder.append(SETUP_CODE_DIGITS.charAt(index));
        }
        return builder.toString();
    }

    private void validatePasswordPolicy(String password) {
        if (password.length() < MIN_PASSWORD_LENGTH || password.length() > MAX_PASSWORD_LENGTH) {
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

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return Base64.getEncoder().encodeToString(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private ProjectMemberAccount toProjectMemberAccount(ProjectMemberEntity member,
                                                        UserEntity user,
                                                        String setupCode,
                                                        OffsetDateTime setupCodeExpiresAt) {
        String loginId = user == null ? "" : user.getEmail();
        boolean passwordInitialized = user != null && user.isPasswordInitialized();
        return new ProjectMemberAccount(
                member.getId(),
                member.getUserId(),
                member.getRole(),
                loginId,
                PASSWORD_MASK,
                passwordInitialized,
                setupCode,
                setupCodeExpiresAt
        );
    }
}

