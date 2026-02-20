package com.bridge.backend.domain.auth;

import com.bridge.backend.common.model.BaseEntity;
import com.bridge.backend.common.model.enums.UserStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "users")
public class UserEntity extends BaseEntity {
    @Column(nullable = false, unique = true, length = 320)
    private String email;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UserStatus status = UserStatus.INVITED;

    @Column(name = "is_platform_admin", nullable = false)
    private boolean platformAdmin;

    @Column(name = "last_login_at")
    private OffsetDateTime lastLoginAt;

    @Column(name = "failed_login_attempts", nullable = false)
    private int failedLoginAttempts;

    @Column(name = "password_initialized", nullable = false)
    private boolean passwordInitialized = true;

    @Column(name = "password_setup_code_hash", length = 255)
    private String passwordSetupCodeHash;

    @Column(name = "password_setup_code_expires_at")
    private OffsetDateTime passwordSetupCodeExpiresAt;
}
