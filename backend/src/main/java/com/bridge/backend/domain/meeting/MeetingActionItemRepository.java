package com.bridge.backend.domain.meeting;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MeetingActionItemRepository extends JpaRepository<MeetingActionItemEntity, UUID> {
    List<MeetingActionItemEntity> findByMeetingIdAndTenantIdAndDeletedAtIsNull(UUID meetingId, UUID tenantId);
}
