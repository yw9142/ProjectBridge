package com.bridge.backend.domain.admin;

import com.bridge.backend.common.model.BaseEntity;
import com.bridge.backend.common.model.enums.MemberRole;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "tenant_members", uniqueConstraints = {
        @UniqueConstraint(name = "uk_tenant_member", columnNames = {"tenant_id", "user_id"})
})
public class TenantMemberEntity extends BaseEntity {
    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private MemberRole role;
}
