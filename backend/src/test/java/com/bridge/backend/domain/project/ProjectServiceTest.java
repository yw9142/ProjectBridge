package com.bridge.backend.domain.project;

import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.MemberRole;
import com.bridge.backend.common.model.enums.UserStatus;
import com.bridge.backend.common.security.AuthPrincipal;
import com.bridge.backend.common.tenant.AccessGuardService;
import com.bridge.backend.domain.admin.TenantMemberEntity;
import com.bridge.backend.domain.admin.TenantMemberRepository;
import com.bridge.backend.domain.auth.UserEntity;
import com.bridge.backend.domain.auth.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private ProjectMemberRepository projectMemberRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TenantMemberRepository tenantMemberRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private AccessGuardService accessGuardService;

    @InjectMocks
    private ProjectService projectService;

    @Test
    void inviteRejectsPmMemberByRole() {
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        AuthPrincipal principal = new AuthPrincipal(userId, tenantId, Set.of("PM_MEMBER"));

        doThrow(new AppException(HttpStatus.FORBIDDEN, "ROLE_FORBIDDEN", "권한이 부족합니다."))
                .when(accessGuardService)
                .requireProjectMemberRole(projectId, userId, tenantId, Set.of(MemberRole.PM_OWNER));

        AppException ex = assertThrows(
                AppException.class,
                () -> projectService.invite(principal, projectId, "member@bridge.local", "Member", MemberRole.CLIENT_MEMBER)
        );

        assertThat(ex.getCode()).isEqualTo("ROLE_FORBIDDEN");
    }

    @Test
    void createRejectsTenantPmMemberWhenOwnerRequired() {
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        AuthPrincipal principal = new AuthPrincipal(userId, tenantId, Set.of("TENANT_PM_MEMBER"));

        doThrow(new AppException(HttpStatus.FORBIDDEN, "ROLE_FORBIDDEN", "권한이 부족합니다."))
                .when(accessGuardService)
                .requireTenantMemberRole(tenantId, userId, Set.of(MemberRole.PM_OWNER));

        AppException ex = assertThrows(
                AppException.class,
                () -> projectService.create(principal, "Project A", "desc")
        );

        assertThat(ex.getCode()).isEqualTo("ROLE_FORBIDDEN");
    }

    @Test
    void resetSetupCodeRejectsPmMemberByRole() {
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID memberId = UUID.randomUUID();
        AuthPrincipal principal = new AuthPrincipal(userId, tenantId, Set.of("PM_MEMBER"));

        doThrow(new AppException(HttpStatus.FORBIDDEN, "ROLE_FORBIDDEN", "권한이 부족합니다."))
                .when(accessGuardService)
                .requireProjectMemberRole(projectId, userId, tenantId, Set.of(MemberRole.PM_OWNER));

        AppException ex = assertThrows(
                AppException.class,
                () -> projectService.resetSetupCode(principal, projectId, memberId)
        );

        assertThat(ex.getCode()).isEqualTo("ROLE_FORBIDDEN");
    }

    @Test
    void inviteAllowsPmOwnerAndReturnsCreatedAccount() {
        UUID tenantId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID memberId = UUID.randomUUID();
        AuthPrincipal principal = new AuthPrincipal(actorId, tenantId, Set.of("PM_OWNER"));

        when(passwordEncoder.encode(any(String.class))).thenReturn("encoded-password");
        when(userRepository.findByEmailAndDeletedAtIsNull("client.owner@bridge.local")).thenReturn(Optional.empty());
        when(userRepository.save(any(UserEntity.class))).thenAnswer(invocation -> {
            UserEntity saved = invocation.getArgument(0);
            if (saved.getId() == null) {
                saved.setId(userId);
            }
            return saved;
        });
        when(tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(tenantId, userId)).thenReturn(Optional.empty());
        when(tenantMemberRepository.save(any(TenantMemberEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(projectMemberRepository.findByProjectIdAndUserIdAndDeletedAtIsNull(projectId, userId)).thenReturn(Optional.empty());
        when(projectMemberRepository.save(any(ProjectMemberEntity.class))).thenAnswer(invocation -> {
            ProjectMemberEntity saved = invocation.getArgument(0);
            if (saved.getId() == null) {
                saved.setId(memberId);
            }
            return saved;
        });
        when(projectRepository.findByTenantIdAndDeletedAtIsNull(tenantId)).thenReturn(List.of());

        ProjectService.ProjectMemberAccount result = projectService.invite(
                principal,
                projectId,
                "Client.Owner@bridge.local",
                "Client Owner",
                MemberRole.CLIENT_OWNER
        );

        assertThat(result.id()).isEqualTo(memberId);
        assertThat(result.userId()).isEqualTo(userId);
        assertThat(result.role()).isEqualTo(MemberRole.CLIENT_OWNER);
        assertThat(result.loginId()).isEqualTo("client.owner@bridge.local");
        assertThat(result.passwordInitialized()).isFalse();
        assertThat(result.setupCode()).isNotBlank();
    }

    @Test
    void membersIsReadOnlyWithoutSaveSideEffects() {
        UUID tenantId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID memberId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        AuthPrincipal principal = new AuthPrincipal(actorId, tenantId, Set.of("PM_OWNER"));

        ProjectMemberEntity membership = new ProjectMemberEntity();
        membership.setId(memberId);
        membership.setTenantId(tenantId);
        membership.setProjectId(projectId);
        membership.setUserId(userId);
        membership.setRole(MemberRole.PM_OWNER);

        UserEntity user = new UserEntity();
        user.setId(userId);
        user.setEmail("owner@bridge.local");
        user.setStatus(UserStatus.ACTIVE);
        user.setPasswordInitialized(true);

        when(accessGuardService.requireProjectMember(projectId, actorId, tenantId)).thenReturn(membership);
        when(projectMemberRepository.findByProjectIdAndDeletedAtIsNull(projectId)).thenReturn(List.of(membership));
        when(userRepository.findAllById(List.of(userId))).thenReturn(List.of(user));

        List<ProjectService.ProjectMemberAccount> members = projectService.members(principal, projectId);

        assertThat(members).hasSize(1);
        assertThat(members.get(0).id()).isEqualTo(memberId);
        assertThat(members.get(0).loginId()).isEqualTo("owner@bridge.local");
        verify(projectMemberRepository, never()).save(any(ProjectMemberEntity.class));
    }

    @Test
    void listReturnsOnlyMembershipProjectsForNonAdmin() {
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID projectIdA = UUID.randomUUID();
        UUID projectIdB = UUID.randomUUID();
        AuthPrincipal principal = new AuthPrincipal(userId, tenantId, Set.of("TENANT_PM_MEMBER"));

        UserEntity user = new UserEntity();
        user.setId(userId);
        user.setPlatformAdmin(false);

        ProjectMemberEntity memberA = new ProjectMemberEntity();
        memberA.setProjectId(projectIdA);
        memberA.setUserId(userId);
        memberA.setTenantId(tenantId);

        ProjectMemberEntity memberB = new ProjectMemberEntity();
        memberB.setProjectId(projectIdB);
        memberB.setUserId(userId);
        memberB.setTenantId(tenantId);

        ProjectEntity projectA = new ProjectEntity();
        projectA.setId(projectIdA);
        projectA.setTenantId(tenantId);
        ProjectEntity projectB = new ProjectEntity();
        projectB.setId(projectIdB);
        projectB.setTenantId(tenantId);

        when(accessGuardService.requireUser(userId)).thenReturn(user);
        when(projectMemberRepository.findByUserIdAndTenantIdAndDeletedAtIsNull(userId, tenantId)).thenReturn(List.of(memberA, memberB));
        when(projectRepository.findByIdInAndTenantIdAndDeletedAtIsNull(List.of(projectIdA, projectIdB), tenantId))
                .thenReturn(List.of(projectA, projectB));

        List<ProjectEntity> projects = projectService.list(principal);

        assertThat(projects).extracting(ProjectEntity::getId).containsExactly(projectIdA, projectIdB);
    }
}
