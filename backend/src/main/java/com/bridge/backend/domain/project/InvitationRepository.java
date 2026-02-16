package com.bridge.backend.domain.project;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface InvitationRepository extends JpaRepository<InvitationEntity, UUID> {
    Optional<InvitationEntity> findByInvitationTokenAndDeletedAtIsNull(String invitationToken);
}
