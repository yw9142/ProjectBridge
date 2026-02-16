package com.bridge.backend.domain.contract;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EnvelopeRepository extends JpaRepository<EnvelopeEntity, UUID> {
    List<EnvelopeEntity> findByContractIdAndTenantIdAndDeletedAtIsNull(UUID contractId, UUID tenantId);
}
