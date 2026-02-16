package com.bridge.backend.domain.contract;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SignatureEventRepository extends JpaRepository<SignatureEventEntity, UUID> {
    List<SignatureEventEntity> findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(UUID envelopeId, UUID tenantId);
}
