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

import java.time.OffsetDateTime;
import java.util.*;

@Service
public class ProjectService {
    private static final String PASSWORD_MASK = "********";

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

    public record ProjectMemberAccount(UUID id, UUID userId, MemberRole role, String loginId, String passwordMask) {
    }

    @Transactional(readOnly = true)
    public List<ProjectEntity> list(AuthPrincipal principal) {
        return projectRepository.findByTenantIdAndDeletedAtIsNull(principal.getTenantId());
    }

    @Transactional
    public ProjectEntity create(AuthPrincipal principal, String name, String description) {
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
            accounts.add(toProjectMemberAccount(member, usersById.get(member.getUserId())));
        }
        return accounts;
    }

    @Transactional
    public ProjectMemberAccount invite(AuthPrincipal principal,
                                       UUID projectId,
                                       String loginId,
                                       String password,
                                       String name,
                                       MemberRole role) {
        accessGuardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        MemberRole resolvedRole = role == null ? MemberRole.CLIENT_MEMBER : role;
        if (loginId == null || loginId.isBlank() || password == null || password.isBlank()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "MEMBER_ACCOUNT_REQUIRED", "Login id and password are required.");
        }

        String normalizedLoginId = loginId.trim().toLowerCase(Locale.ROOT);
        UserEntity user = userRepository.findByEmailAndDeletedAtIsNull(normalizedLoginId).orElseGet(() -> {
            UserEntity entity = new UserEntity();
            entity.setEmail(normalizedLoginId);
            entity.setName((name == null || name.isBlank()) ? normalizedLoginId.split("@")[0] : name.trim());
            entity.setPasswordHash(passwordEncoder.encode(password));
            entity.setStatus(UserStatus.ACTIVE);
            entity.setCreatedBy(principal.getUserId());
            entity.setUpdatedBy(principal.getUserId());
            return userRepository.save(entity);
        });
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setStatus(UserStatus.ACTIVE);
        if (name != null && !name.isBlank()) {
            user.setName(name.trim());
        }
        user.setUpdatedBy(principal.getUserId());
        UserEntity savedUser = userRepository.save(user);

        if (tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(principal.getTenantId(), savedUser.getId()).isEmpty()) {
            TenantMemberEntity tenantMember = new TenantMemberEntity();
            tenantMember.setTenantId(principal.getTenantId());
            tenantMember.setUserId(savedUser.getId());
            tenantMember.setRole(resolvedRole);
            tenantMember.setCreatedBy(principal.getUserId());
            tenantMember.setUpdatedBy(principal.getUserId());
            tenantMemberRepository.save(tenantMember);
        }

        ProjectMemberEntity member = projectMemberRepository.findByProjectIdAndUserIdAndDeletedAtIsNull(projectId, savedUser.getId())
                .orElseGet(() -> {
                    ProjectMemberEntity created = new ProjectMemberEntity();
                    created.setTenantId(principal.getTenantId());
                    created.setProjectId(projectId);
                    created.setUserId(savedUser.getId());
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
        return toProjectMemberAccount(savedMember, savedUser);
    }

    @Transactional
    public ProjectMemberEntity updateMemberRole(AuthPrincipal principal, UUID projectId, UUID memberId, MemberRole role) {
        accessGuardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(), Set.of(MemberRole.PM_OWNER));
        ProjectMemberEntity member = projectMemberRepository.findById(memberId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "硫ㅻ쾭瑜?李얠쓣 ???놁뒿?덈떎."));
        if (member.getDeletedAt() != null || !member.getProjectId().equals(projectId)) {
            throw new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "硫ㅻ쾭瑜?李얠쓣 ???놁뒿?덈떎.");
        }
        member.setRole(role);
        member.setUpdatedBy(principal.getUserId());
        return projectMemberRepository.save(member);
    }

    @Transactional
    public ProjectMemberAccount updateMemberAccount(AuthPrincipal principal,
                                                    UUID projectId,
                                                    UUID memberId,
                                                    String loginId,
                                                    String password) {
        accessGuardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(), Set.of(MemberRole.PM_OWNER));
        ProjectMemberEntity member = projectMemberRepository.findById(memberId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "筌롢끇苡?몴?筌≪뼚??????곷뮸??덈뼄."));
        if (member.getDeletedAt() != null || !member.getProjectId().equals(projectId)) {
            throw new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "筌롢끇苡?몴?筌≪뼚??????곷뮸??덈뼄.");
        }

        boolean hasLoginId = loginId != null && !loginId.isBlank();
        boolean hasPassword = password != null && !password.isBlank();
        if (!hasLoginId && !hasPassword) {
            throw new AppException(HttpStatus.BAD_REQUEST, "ACCOUNT_UPDATE_EMPTY", "癰궰野껋?釉??④쑴???類ｋ궖揶쎛 ??곷뮸??덈뼄.");
        }

        UserEntity user = userRepository.findByIdAndDeletedAtIsNull(member.getUserId())
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "????癒? 筌≪뼚??????곷뮸??덈뼄."));

        if (hasLoginId) {
            String normalizedLoginId = loginId.trim().toLowerCase(Locale.ROOT);
            userRepository.findByEmailAndDeletedAtIsNull(normalizedLoginId).ifPresent(existing -> {
                if (!existing.getId().equals(user.getId())) {
                    throw new AppException(HttpStatus.CONFLICT, "LOGIN_ID_DUPLICATE", "??? 嚥≪뮄???ID揶쎛 ??? ????餓λ쵐???덈뼄.");
                }
            });
            user.setEmail(normalizedLoginId);
            if (user.getName() == null || user.getName().isBlank()) {
                user.setName(normalizedLoginId.split("@")[0]);
            }
        }

        if (hasPassword) {
            user.setPasswordHash(passwordEncoder.encode(password));
            user.setStatus(UserStatus.ACTIVE);
        }

        user.setUpdatedBy(principal.getUserId());
        UserEntity updatedUser = userRepository.save(user);
        return toProjectMemberAccount(member, updatedUser);
    }

    @Transactional
    public Map<String, Object> removeMember(AuthPrincipal principal, UUID projectId, UUID memberId) {
        accessGuardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(), Set.of(MemberRole.PM_OWNER));
        ProjectMemberEntity member = projectMemberRepository.findById(memberId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "硫ㅻ쾭瑜?李얠쓣 ???놁뒿?덈떎."));
        if (member.getDeletedAt() != null || !member.getProjectId().equals(projectId)) {
            throw new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "硫ㅻ쾭瑜?李얠쓣 ???놁뒿?덈떎.");
        }
        if (member.getUserId().equals(principal.getUserId())) {
            throw new AppException(HttpStatus.BAD_REQUEST, "SELF_REMOVE_FORBIDDEN", "蹂몄씤 硫ㅻ쾭??? ??젣?????놁뒿?덈떎.");
        }
        member.setDeletedAt(OffsetDateTime.now());
        member.setUpdatedBy(principal.getUserId());
        projectMemberRepository.save(member);
        return Map.of("deleted", true);
    }

    private ProjectMemberAccount toProjectMemberAccount(ProjectMemberEntity member, UserEntity user) {
        String loginId = user == null ? "" : user.getEmail();
        return new ProjectMemberAccount(member.getId(), member.getUserId(), member.getRole(), loginId, PASSWORD_MASK);
    }
}

