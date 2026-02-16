package com.bridge.backend.domain.contract;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SignatureRecipientRepository extends JpaRepository<SignatureRecipientEntity, UUID> {
    List<SignatureRecipientEntity> findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(UUID envelopeId, UUID tenantId);

    Optional<SignatureRecipientEntity> findByRecipientTokenAndDeletedAtIsNull(String recipientToken);
}
