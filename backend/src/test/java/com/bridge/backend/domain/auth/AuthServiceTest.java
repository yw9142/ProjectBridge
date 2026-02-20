package com.bridge.backend.domain.auth;

import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.UserStatus;
import com.bridge.backend.common.security.JwtProperties;
import com.bridge.backend.common.security.JwtService;
import com.bridge.backend.domain.admin.TenantMemberRepository;
import com.bridge.backend.domain.admin.TenantRepository;
import com.bridge.backend.domain.project.ProjectMemberRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
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
    @Mock
    private JwtProperties jwtProperties;

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

    @Test
    void refreshUsesConfiguredExpirationDaysForStoredToken() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        String refreshToken = "existing-refresh-token";
        String newRefreshToken = "next-refresh-token";

        var claims = mock(io.jsonwebtoken.Claims.class);
        when(claims.getSubject()).thenReturn(userId.toString());
        when(claims.get("tenantId", String.class)).thenReturn(tenantId.toString());

        RefreshTokenEntity savedToken = new RefreshTokenEntity();
        savedToken.setTokenHash(sha256(refreshToken));
        savedToken.setUserId(userId);
        savedToken.setTenantId(tenantId);
        savedToken.setExpiresAt(OffsetDateTime.now().plusDays(1));

        UserEntity user = new UserEntity();
        user.setId(userId);
        user.setStatus(UserStatus.ACTIVE);
        user.setPasswordInitialized(true);

        when(jwtService.parse(refreshToken)).thenReturn(claims);
        when(jwtService.isRefreshToken(claims)).thenReturn(true);
        when(refreshTokenRepository.findByTokenHashAndRevokedAtIsNull(sha256(refreshToken))).thenReturn(Optional.of(savedToken));
        when(projectMemberRepository.findByUserIdAndTenantIdAndDeletedAtIsNull(userId, tenantId)).thenReturn(List.of());
        when(userRepository.findByIdAndDeletedAtIsNull(userId)).thenReturn(Optional.of(user));
        when(tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(tenantId, userId)).thenReturn(Optional.empty());
        when(jwtService.issueAccessToken(userId, tenantId, Set.of())).thenReturn("new-access-token");
        when(jwtService.issueRefreshToken(userId, tenantId)).thenReturn(newRefreshToken);
        when(jwtProperties.getRefreshExpirationDays()).thenReturn(7L);

        authService.refresh(refreshToken);

        ArgumentCaptor<RefreshTokenEntity> tokenCaptor = ArgumentCaptor.forClass(RefreshTokenEntity.class);
        verify(refreshTokenRepository, times(2)).save(tokenCaptor.capture());
        RefreshTokenEntity nextToken = tokenCaptor.getAllValues().get(1);
        OffsetDateTime lowerBound = OffsetDateTime.now().plusDays(7).minusMinutes(1);
        OffsetDateTime upperBound = OffsetDateTime.now().plusDays(7).plusMinutes(1);
        assertThat(nextToken.getExpiresAt()).isAfter(lowerBound);
        assertThat(nextToken.getExpiresAt()).isBefore(upperBound);
        assertThat(nextToken.getTokenHash()).isEqualTo(sha256(newRefreshToken));
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return Base64.getEncoder().encodeToString(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}
