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
    void requireProjectMemberAllowsTenantPmOwnerWithoutProjectMembership() {
        UUID projectId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project(projectId, tenantId)));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user(userId, false)));
        when(projectMemberRepository.findByProjectIdAndUserIdAndDeletedAtIsNull(projectId, userId)).thenReturn(Optional.empty());
        when(tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(tenantId, userId))
                .thenReturn(Optional.of(tenantMember(tenantId, userId, MemberRole.PM_OWNER)));

        ProjectMemberEntity result = accessGuardService.requireProjectMember(projectId, userId, tenantId);

        assertThat(result.getRole()).isEqualTo(MemberRole.PM_OWNER);
        assertThat(result.getProjectId()).isEqualTo(projectId);
        assertThat(result.getUserId()).isEqualTo(userId);
    }

    @Test
    void requireProjectMemberThrowsWhenTenantMemberIsNotPmRole() {
        UUID projectId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project(projectId, tenantId)));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user(userId, false)));
        when(projectMemberRepository.findByProjectIdAndUserIdAndDeletedAtIsNull(projectId, userId)).thenReturn(Optional.empty());
        when(tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(tenantId, userId))
                .thenReturn(Optional.of(tenantMember(tenantId, userId, MemberRole.CLIENT_OWNER)));

        AppException ex = assertThrows(AppException.class, () -> accessGuardService.requireProjectMember(projectId, userId, tenantId));

        assertThat(ex.getCode()).isEqualTo("PROJECT_MEMBER_REQUIRED");
    }

    @Test
    void requireProjectMemberRoleRejectsTenantPmMemberWhenOwnerRequired() {
        UUID projectId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project(projectId, tenantId)));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user(userId, false)));
        when(projectMemberRepository.findByProjectIdAndUserIdAndDeletedAtIsNull(projectId, userId)).thenReturn(Optional.empty());
        when(tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(tenantId, userId))
                .thenReturn(Optional.of(tenantMember(tenantId, userId, MemberRole.PM_MEMBER)));

        AppException ex = assertThrows(
                AppException.class,
                () -> accessGuardService.requireProjectMemberRole(projectId, userId, tenantId, Set.of(MemberRole.PM_OWNER))
        );

        assertThat(ex.getCode()).isEqualTo("ROLE_FORBIDDEN");
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

    private static TenantMemberEntity tenantMember(UUID tenantId, UUID userId, MemberRole role) {
        TenantMemberEntity tenantMember = new TenantMemberEntity();
        tenantMember.setTenantId(tenantId);
        tenantMember.setUserId(userId);
        tenantMember.setRole(role);
        return tenantMember;
    }
}
