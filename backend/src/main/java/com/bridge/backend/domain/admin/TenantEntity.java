package com.bridge.backend.domain.admin;

import com.bridge.backend.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "tenants")
public class TenantEntity extends BaseEntity {
    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false, unique = true, length = 80)
    private String slug;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";
}
