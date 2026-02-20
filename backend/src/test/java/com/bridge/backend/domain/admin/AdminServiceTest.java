package com.bridge.backend.domain.admin;

import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.MemberRole;
import com.bridge.backend.common.model.enums.UserStatus;
import com.bridge.backend.domain.auth.UserEntity;
import com.bridge.backend.domain.auth.UserRepository;
import com.bridge.backend.domain.project.ProjectEntity;
import com.bridge.backend.domain.project.ProjectMemberRepository;
import com.bridge.backend.domain.project.ProjectRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock
    private TenantRepository tenantRepository;
    @Mock
    private TenantMemberRepository tenantMemberRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ProjectMemberRepository projectMemberRepository;
    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AdminService adminService;

    @Test
    void createTenantUserIssuesSetupCodeForNewUser() {
        UUID tenantId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        String email = "new-pm@bridge.local";

        TenantEntity tenant = new TenantEntity();
        tenant.setId(tenantId);

        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));
        when(userRepository.findByEmailAndDeletedAtIsNull(email)).thenReturn(Optional.empty());
        when(passwordEncoder.encode(any(String.class))).thenReturn("encoded-password");
        when(userRepository.save(any(UserEntity.class))).thenAnswer(invocation -> {
            UserEntity saved = invocation.getArgument(0);
            if (saved.getId() == null) {
                saved.setId(UUID.randomUUID());
            }
            return saved;
        });
        when(tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(eq(tenantId), any(UUID.class)))
                .thenReturn(Optional.empty());
        when(projectRepository.findByTenantIdAndDeletedAtIsNull(tenantId)).thenReturn(List.of());

        AdminService.SetupCodeIssueResult result = adminService.createTenantUser(tenantId, email, "New PM", null, actorId);

        assertThat(result.email()).isEqualTo(email);
        assertThat(result.status()).isEqualTo(UserStatus.INVITED);
        assertThat(result.passwordInitialized()).isFalse();
        assertThat(result.setupCode()).isNotBlank();
        assertThat(result.setupCode()).hasSize(8);
        assertThat(result.setupCodeExpiresAt()).isNotNull();
        verify(tenantMemberRepository).save(argThat(member -> member.getRole() == MemberRole.PM_MEMBER));
    }

    @Test
    void createTenantUserDoesNotIssueSetupCodeForInitializedAccount() {
        UUID tenantId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        String email = "existing-pm@bridge.local";

        TenantEntity tenant = new TenantEntity();
        tenant.setId(tenantId);
        UserEntity existing = new UserEntity();
        existing.setId(UUID.randomUUID());
        existing.setEmail(email);
        existing.setStatus(UserStatus.ACTIVE);
        existing.setPasswordInitialized(true);

        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));
        when(userRepository.findByEmailAndDeletedAtIsNull(email)).thenReturn(Optional.of(existing));
        when(tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(tenantId, existing.getId()))
                .thenReturn(Optional.of(new TenantMemberEntity()));
        when(projectRepository.findByTenantIdAndDeletedAtIsNull(tenantId)).thenReturn(List.of());

        AdminService.SetupCodeIssueResult result = adminService.createTenantUser(tenantId, email, "Existing PM", null, actorId);

        assertThat(result.passwordInitialized()).isTrue();
        assertThat(result.setupCode()).isNull();
        assertThat(result.setupCodeExpiresAt()).isNull();
        verify(userRepository, never()).save(existing);
    }

    @Test
    void createTenantUserSyncsProjectMembershipForSingleProjectTenant() {
        UUID tenantId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        String email = "single-project@bridge.local";

        TenantEntity tenant = new TenantEntity();
        tenant.setId(tenantId);

        ProjectEntity project = new ProjectEntity();
        project.setId(projectId);
        project.setTenantId(tenantId);

        UserEntity existing = new UserEntity();
        existing.setId(userId);
        existing.setEmail(email);
        existing.setStatus(UserStatus.ACTIVE);
        existing.setPasswordInitialized(true);

        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));
        when(userRepository.findByEmailAndDeletedAtIsNull(email)).thenReturn(Optional.of(existing));
        when(tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(tenantId, userId)).thenReturn(Optional.empty());
        when(projectRepository.findByTenantIdAndDeletedAtIsNull(tenantId)).thenReturn(List.of(project));
        when(projectMemberRepository.findByProjectIdAndUserIdAndDeletedAtIsNull(projectId, userId)).thenReturn(Optional.empty());
        when(projectMemberRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        adminService.createTenantUser(tenantId, email, "Single Project User", MemberRole.CLIENT_OWNER, actorId);

        verify(projectMemberRepository, times(1)).save(argThat(member -> member.getRole() == MemberRole.CLIENT_OWNER));
    }

    @Test
    void resetSetupCodeIssuesNewCodeForUninitializedUser() {
        UUID actorId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity();
        user.setId(userId);
        user.setEmail("pm-reset@bridge.local");
        user.setStatus(UserStatus.INVITED);
        user.setPasswordInitialized(false);

        when(userRepository.findByIdAndDeletedAtIsNull(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        AdminService.SetupCodeIssueResult result = adminService.resetSetupCode(userId, actorId);

        assertThat(result.userId()).isEqualTo(userId);
        assertThat(result.passwordInitialized()).isFalse();
        assertThat(result.setupCode()).hasSize(8);
        assertThat(result.setupCodeExpiresAt()).isNotNull();
        assertThat(user.getPasswordSetupCodeHash()).isNotBlank();
        assertThat(user.getPasswordSetupCodeExpiresAt()).isNotNull();
        verify(userRepository).save(user);
    }

    @Test
    void resetSetupCodeRejectsInitializedUser() {
        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity();
        user.setId(userId);
        user.setPasswordInitialized(true);

        when(userRepository.findByIdAndDeletedAtIsNull(userId)).thenReturn(Optional.of(user));

        AppException ex = assertThrows(AppException.class, () -> adminService.resetSetupCode(userId, UUID.randomUUID()));

        assertThat(ex.getCode()).isEqualTo("PASSWORD_ALREADY_INITIALIZED");
    }

    @Test
    void unlockLoginResetsFailedAttempts() {
        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity();
        user.setId(userId);
        user.setFailedLoginAttempts(5);

        when(userRepository.findByIdAndDeletedAtIsNull(userId)).thenReturn(Optional.of(user));

        Map<String, Object> result = adminService.unlockLogin(userId);

        assertThat(user.getFailedLoginAttempts()).isEqualTo(0);
        assertThat(result.get("loginBlocked")).isEqualTo(false);
        assertThat(result.get("failedLoginAttempts")).isEqualTo(0);
        verify(userRepository).save(user);
    }

    @Test
    void getUserDetailAllowsNullFields() {
        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity();
        user.setId(userId);
        user.setEmail("member@bridge.local");
        user.setName(null);
        user.setPasswordInitialized(false);

        when(userRepository.findByIdAndDeletedAtIsNull(userId)).thenReturn(Optional.of(user));
        when(tenantMemberRepository.findByUserIdAndDeletedAtIsNull(userId)).thenReturn(List.of());
        when(tenantRepository.findAllById(any())).thenReturn(List.of());

        Map<String, Object> result = adminService.getUserDetail(userId);

        assertThat(result.get("userId")).isEqualTo(userId);
        assertThat(result).containsEntry("lastLoginAt", null);
        assertThat(result).containsEntry("name", null);
    }
}
