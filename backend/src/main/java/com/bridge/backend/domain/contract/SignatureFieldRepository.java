package com.bridge.backend.domain.contract;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SignatureFieldRepository extends JpaRepository<SignatureFieldEntity, UUID> {
    List<SignatureFieldEntity> findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(UUID envelopeId, UUID tenantId);
}
