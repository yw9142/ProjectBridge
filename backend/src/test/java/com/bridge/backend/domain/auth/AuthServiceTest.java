package com.bridge.backend.domain.auth;

import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.UserStatus;
import com.bridge.backend.common.security.JwtService;
import com.bridge.backend.domain.admin.TenantMemberRepository;
import com.bridge.backend.domain.admin.TenantRepository;
import com.bridge.backend.domain.project.ProjectMemberRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private TenantRepository tenantRepository;
    @Mock
    private TenantMemberRepository tenantMemberRepository;
    @Mock
    private ProjectMemberRepository projectMemberRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtService jwtService;

    @InjectMocks
    private AuthService authService;

    @Test
    void loginBlocksAfterFifthFailure() {
        UserEntity user = new UserEntity();
        user.setEmail("client@bridge.local");
        user.setPasswordHash("hashed-password");
        user.setStatus(UserStatus.ACTIVE);
        user.setPasswordInitialized(true);
        user.setFailedLoginAttempts(4);

        when(userRepository.findByEmailAndDeletedAtIsNull("client@bridge.local"))
                .thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", "hashed-password")).thenReturn(false);

        AppException ex = assertThrows(
                AppException.class,
                () -> authService.login("client@bridge.local", "wrong-password", "bridge")
        );

        assertThat(ex.getCode()).isEqualTo("LOGIN_BLOCKED");
        assertThat(user.getFailedLoginAttempts()).isEqualTo(5);
        verify(userRepository).save(user);
    }

    @Test
    void blockedUserCannotLoginEvenWithCorrectPassword() {
        UserEntity user = new UserEntity();
        user.setEmail("client@bridge.local");
        user.setPasswordHash("hashed-password");
        user.setStatus(UserStatus.ACTIVE);
        user.setPasswordInitialized(true);
        user.setFailedLoginAttempts(5);

        when(userRepository.findByEmailAndDeletedAtIsNull("client@bridge.local"))
                .thenReturn(Optional.of(user));

        AppException ex = assertThrows(
                AppException.class,
                () -> authService.login("client@bridge.local", "correct-password", "bridge")
        );

        assertThat(ex.getCode()).isEqualTo("LOGIN_BLOCKED");
    }
}
