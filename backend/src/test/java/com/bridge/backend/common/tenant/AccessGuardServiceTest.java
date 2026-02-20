package com.bridge.backend.common.tenant;

import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.MemberRole;
import com.bridge.backend.domain.admin.TenantMemberEntity;
import com.bridge.backend.domain.admin.TenantMemberRepository;
import com.bridge.backend.domain.auth.UserEntity;
import com.bridge.backend.domain.auth.UserRepository;
import com.bridge.backend.domain.project.ProjectEntity;
import com.bridge.backend.domain.project.ProjectMemberEntity;
import com.bridge.backend.domain.project.ProjectMemberRepository;
import com.bridge.backend.domain.project.ProjectRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccessGuardServiceTest {

    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private ProjectMemberRepository projectMemberRepository;
    @Mock
    private TenantMemberRepository tenantMemberRepository;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private AccessGuardService accessGuardService;

    @Test
    void requireProjectMemberThrowsWhenProjectMembershipMissing() {
        UUID projectId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project(projectId, tenantId)));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user(userId, false)));
        when(projectMemberRepository.findByProjectIdAndUserIdAndDeletedAtIsNull(projectId, userId)).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class, () -> accessGuardService.requireProjectMember(projectId, userId, tenantId));

        assertThat(ex.getCode()).isEqualTo("PROJECT_MEMBER_REQUIRED");
    }

    @Test
    void requireProjectMemberAllowsPlatformAdminWithoutProjectMembership() {
        UUID projectId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project(projectId, tenantId)));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user(userId, true)));

        ProjectMemberEntity result = accessGuardService.requireProjectMember(projectId, userId, tenantId);

        assertThat(result.getRole()).isEqualTo(MemberRole.PM_OWNER);
        assertThat(result.getProjectId()).isEqualTo(projectId);
        assertThat(result.getUserId()).isEqualTo(userId);
    }

    @Test
    void requireProjectMemberAllowsProjectMembership() {
        UUID projectId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        ProjectMemberEntity membership = new ProjectMemberEntity();
        membership.setTenantId(tenantId);
        membership.setProjectId(projectId);
        membership.setUserId(userId);
        membership.setRole(MemberRole.PM_MEMBER);

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project(projectId, tenantId)));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user(userId, false)));
        when(projectMemberRepository.findByProjectIdAndUserIdAndDeletedAtIsNull(projectId, userId)).thenReturn(Optional.of(membership));

        ProjectMemberEntity result = accessGuardService.requireProjectMember(projectId, userId, tenantId);

        assertThat(result.getRole()).isEqualTo(MemberRole.PM_MEMBER);
        assertThat(result.getProjectId()).isEqualTo(projectId);
        assertThat(result.getUserId()).isEqualTo(userId);
    }

    @Test
    void requireProjectMemberRoleRejectsTenantPmMemberWhenOwnerRequired() {
        UUID projectId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project(projectId, tenantId)));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user(userId, false)));
        ProjectMemberEntity membership = new ProjectMemberEntity();
        membership.setTenantId(tenantId);
        membership.setProjectId(projectId);
        membership.setUserId(userId);
        membership.setRole(MemberRole.PM_MEMBER);
        when(projectMemberRepository.findByProjectIdAndUserIdAndDeletedAtIsNull(projectId, userId)).thenReturn(Optional.of(membership));

        AppException ex = assertThrows(
                AppException.class,
                () -> accessGuardService.requireProjectMemberRole(projectId, userId, tenantId, Set.of(MemberRole.PM_OWNER))
        );

        assertThat(ex.getCode()).isEqualTo("ROLE_FORBIDDEN");
    }

    @Test
    void requireTenantMemberRoleRejectsTenantPmMemberWhenOwnerRequired() {
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        TenantMemberEntity membership = new TenantMemberEntity();
        membership.setTenantId(tenantId);
        membership.setUserId(userId);
        membership.setRole(MemberRole.PM_MEMBER);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user(userId, false)));
        when(tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(tenantId, userId)).thenReturn(Optional.of(membership));

        AppException ex = assertThrows(
                AppException.class,
                () -> accessGuardService.requireTenantMemberRole(tenantId, userId, Set.of(MemberRole.PM_OWNER))
        );

        assertThat(ex.getCode()).isEqualTo("ROLE_FORBIDDEN");
    }

    @Test
    void requireTenantMemberRoleAllowsPlatformAdminWithoutTenantMembership() {
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user(userId, true)));

        TenantMemberEntity membership = accessGuardService.requireTenantMemberRole(
                tenantId,
                userId,
                Set.of(MemberRole.PM_OWNER)
        );

        assertThat(membership.getTenantId()).isEqualTo(tenantId);
        assertThat(membership.getUserId()).isEqualTo(userId);
        assertThat(membership.getRole()).isEqualTo(MemberRole.PM_OWNER);
    }

    private static ProjectEntity project(UUID projectId, UUID tenantId) {
        ProjectEntity project = new ProjectEntity();
        project.setId(projectId);
        project.setTenantId(tenantId);
        return project;
    }

    private static UserEntity user(UUID userId, boolean platformAdmin) {
        UserEntity user = new UserEntity();
        user.setId(userId);
        user.setPlatformAdmin(platformAdmin);
        return user;
    }

}
