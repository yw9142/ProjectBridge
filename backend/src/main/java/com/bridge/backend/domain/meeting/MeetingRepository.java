package com.bridge.backend.domain.meeting;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MeetingRepository extends JpaRepository<MeetingEntity, UUID> {
    List<MeetingEntity> findByProjectIdAndTenantIdAndDeletedAtIsNull(UUID projectId, UUID tenantId);
}
