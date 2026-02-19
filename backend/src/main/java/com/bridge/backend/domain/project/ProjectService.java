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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class ProjectService {
    private static final String PASSWORD_MASK = "********";

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final InvitationRepository invitationRepository;
    private final UserRepository userRepository;
    private final TenantMemberRepository tenantMemberRepository;
    private final PasswordEncoder passwordEncoder;
    private final AccessGuardService accessGuardService;

    public ProjectService(ProjectRepository projectRepository,
                          ProjectMemberRepository projectMemberRepository,
                          InvitationRepository invitationRepository,
                          UserRepository userRepository,
                          TenantMemberRepository tenantMemberRepository,
                          PasswordEncoder passwordEncoder,
                          AccessGuardService accessGuardService) {
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.invitationRepository = invitationRepository;
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
    public InvitationEntity invite(AuthPrincipal principal,
                                   UUID projectId,
                                   String invitedEmail,
                                   MemberRole role,
                                   String loginId,
                                   String password,
                                   String name) {
        accessGuardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        MemberRole resolvedRole = role == null ? MemberRole.CLIENT_MEMBER : role;

        if (loginId != null && !loginId.isBlank() && password != null && !password.isBlank()) {
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
            user.setUpdatedBy(principal.getUserId());
            userRepository.save(user);

            if (tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(principal.getTenantId(), user.getId()).isEmpty()) {
                TenantMemberEntity tenantMember = new TenantMemberEntity();
                tenantMember.setTenantId(principal.getTenantId());
                tenantMember.setUserId(user.getId());
                tenantMember.setRole(resolvedRole);
                tenantMember.setCreatedBy(principal.getUserId());
                tenantMember.setUpdatedBy(principal.getUserId());
                tenantMemberRepository.save(tenantMember);
            }

            if (projectMemberRepository.findByProjectIdAndUserIdAndDeletedAtIsNull(projectId, user.getId()).isEmpty()) {
                ProjectMemberEntity member = new ProjectMemberEntity();
                member.setTenantId(principal.getTenantId());
                member.setProjectId(projectId);
                member.setUserId(user.getId());
                member.setRole(resolvedRole);
                member.setCreatedBy(principal.getUserId());
                member.setUpdatedBy(principal.getUserId());
                projectMemberRepository.save(member);
            }
        }

        InvitationEntity invitation = new InvitationEntity();
        invitation.setTenantId(principal.getTenantId());
        invitation.setProjectId(projectId);
        invitation.setInvitedEmail(invitedEmail);
        invitation.setRole(resolvedRole);
        invitation.setInvitationToken(UUID.randomUUID().toString().replace("-", ""));
        invitation.setExpiresAt(OffsetDateTime.now().plusDays(7));
        invitation.setCreatedBy(principal.getUserId());
        invitation.setUpdatedBy(principal.getUserId());
        return invitationRepository.save(invitation);
    }

    @Transactional
    public Map<String, Object> acceptInvitation(AuthPrincipal principal, String invitationToken) {
        InvitationEntity invitation = requireActiveInvitation(invitationToken);
        UserEntity user = userRepository.findById(principal.getUserId())
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found."));
        if (!user.getEmail().equalsIgnoreCase(invitation.getInvitedEmail())) {
            throw new AppException(HttpStatus.FORBIDDEN, "INVITATION_EMAIL_MISMATCH", "Invitation email does not match.");
        }
        if (projectMemberRepository.findByProjectIdAndUserIdAndDeletedAtIsNull(invitation.getProjectId(), user.getId()).isEmpty()) {
            ProjectMemberEntity member = new ProjectMemberEntity();
            member.setTenantId(invitation.getTenantId());
            member.setProjectId(invitation.getProjectId());
            member.setUserId(user.getId());
            member.setRole(invitation.getRole());
            member.setCreatedBy(principal.getUserId());
            member.setUpdatedBy(principal.getUserId());
            projectMemberRepository.save(member);
        }
        invitation.setAcceptedAt(OffsetDateTime.now());
        invitationRepository.save(invitation);
        return Map.of("accepted", true, "projectId", invitation.getProjectId());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getInvitation(String invitationToken) {
        InvitationEntity invitation = requireActiveInvitation(invitationToken);
        return Map.of(
                "invitationToken", invitation.getInvitationToken(),
                "projectId", invitation.getProjectId(),
                "tenantId", invitation.getTenantId(),
                "invitedEmail", invitation.getInvitedEmail(),
                "role", invitation.getRole(),
                "expiresAt", invitation.getExpiresAt(),
                "accepted", invitation.getAcceptedAt() != null
        );
    }

    @Transactional
    public Map<String, Object> acceptInvitationPublic(String invitationToken, String email, String password, String name) {
        InvitationEntity invitation = requireActiveInvitation(invitationToken);
        String normalizedEmail = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        if (!invitation.getInvitedEmail().equalsIgnoreCase(normalizedEmail)) {
            throw new AppException(HttpStatus.FORBIDDEN, "INVITATION_EMAIL_MISMATCH", "Invitation email does not match.");
        }

        UserEntity user = userRepository.findByEmailAndDeletedAtIsNull(normalizedEmail).orElseGet(() -> {
            UserEntity created = new UserEntity();
            created.setEmail(normalizedEmail);
            created.setName((name == null || name.isBlank()) ? normalizedEmail.split("@")[0] : name.trim());
            created.setPasswordHash(passwordEncoder.encode(password));
            created.setStatus(UserStatus.ACTIVE);
            created.setCreatedBy(invitation.getCreatedBy());
            created.setUpdatedBy(invitation.getCreatedBy());
            return userRepository.save(created);
        });
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setStatus(UserStatus.ACTIVE);
        if (name != null && !name.isBlank()) {
            user.setName(name.trim());
        }
        user.setUpdatedBy(invitation.getCreatedBy());
        userRepository.save(user);

        if (tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(invitation.getTenantId(), user.getId()).isEmpty()) {
            TenantMemberEntity tenantMember = new TenantMemberEntity();
            tenantMember.setTenantId(invitation.getTenantId());
            tenantMember.setUserId(user.getId());
            tenantMember.setRole(invitation.getRole());
            tenantMember.setCreatedBy(invitation.getCreatedBy());
            tenantMember.setUpdatedBy(invitation.getCreatedBy());
            tenantMemberRepository.save(tenantMember);
        }

        if (projectMemberRepository.findByProjectIdAndUserIdAndDeletedAtIsNull(invitation.getProjectId(), user.getId()).isEmpty()) {
            ProjectMemberEntity member = new ProjectMemberEntity();
            member.setTenantId(invitation.getTenantId());
            member.setProjectId(invitation.getProjectId());
            member.setUserId(user.getId());
            member.setRole(invitation.getRole());
            member.setCreatedBy(invitation.getCreatedBy());
            member.setUpdatedBy(invitation.getCreatedBy());
            projectMemberRepository.save(member);
        }

        invitation.setAcceptedAt(OffsetDateTime.now());
        invitationRepository.save(invitation);

        return Map.of(
                "accepted", true,
                "projectId", invitation.getProjectId(),
                "tenantId", invitation.getTenantId()
        );
    }

    @Transactional
    public ProjectMemberEntity updateMemberRole(AuthPrincipal principal, UUID projectId, UUID memberId, MemberRole role) {
        accessGuardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(), Set.of(MemberRole.PM_OWNER));
        ProjectMemberEntity member = projectMemberRepository.findById(memberId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Member not found."));
        if (member.getDeletedAt() != null || !member.getProjectId().equals(projectId)) {
            throw new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Member not found.");
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
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Member not found."));
        if (member.getDeletedAt() != null || !member.getProjectId().equals(projectId)) {
            throw new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Member not found.");
        }

        boolean hasLoginId = loginId != null && !loginId.isBlank();
        boolean hasPassword = password != null && !password.isBlank();
        if (!hasLoginId && !hasPassword) {
            throw new AppException(HttpStatus.BAD_REQUEST, "ACCOUNT_UPDATE_EMPTY", "At least one account field is required.");
        }

        UserEntity user = userRepository.findByIdAndDeletedAtIsNull(member.getUserId())
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found."));

        if (hasLoginId) {
            String normalizedLoginId = loginId.trim().toLowerCase(Locale.ROOT);
            userRepository.findByEmailAndDeletedAtIsNull(normalizedLoginId).ifPresent(existing -> {
                if (!existing.getId().equals(user.getId())) {
                    throw new AppException(HttpStatus.CONFLICT, "LOGIN_ID_DUPLICATE", "Login ID is already in use.");
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
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Member not found."));
        if (member.getDeletedAt() != null || !member.getProjectId().equals(projectId)) {
            throw new AppException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Member not found.");
        }
        if (member.getUserId().equals(principal.getUserId())) {
            throw new AppException(HttpStatus.BAD_REQUEST, "SELF_REMOVE_FORBIDDEN", "Cannot remove self from project.");
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

    private InvitationEntity requireActiveInvitation(String invitationToken) {
        InvitationEntity invitation = invitationRepository.findByInvitationTokenAndDeletedAtIsNull(invitationToken)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "INVITATION_NOT_FOUND", "Invitation not found."));
        if (invitation.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVITATION_EXPIRED", "Invitation expired.");
        }
        return invitation;
    }
}
