package com.bridge.backend.domain.project;

import com.bridge.backend.common.model.TenantScopedEntity;
import com.bridge.backend.common.model.enums.MemberRole;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "invitations")
public class InvitationEntity extends TenantScopedEntity {
    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "invited_email", nullable = false, length = 320)
    private String invitedEmail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private MemberRole role;

    @Column(name = "invitation_token", nullable = false, unique = true, length = 120)
    private String invitationToken;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "accepted_at")
    private OffsetDateTime acceptedAt;
}
