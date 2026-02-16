package com.bridge.backend.domain.meeting;

import com.bridge.backend.common.api.ApiSuccess;
import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.AttendeeResponse;
import com.bridge.backend.common.model.enums.MemberRole;
import com.bridge.backend.common.model.enums.MeetingStatus;
import com.bridge.backend.common.security.SecurityUtils;
import com.bridge.backend.common.tenant.AccessGuardService;
import com.bridge.backend.domain.notification.OutboxService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
public class MeetingController {
    private final MeetingRepository meetingRepository;
    private final MeetingAttendeeRepository meetingAttendeeRepository;
    private final MeetingActionItemRepository actionItemRepository;
    private final AccessGuardService guardService;
    private final OutboxService outboxService;

    public MeetingController(MeetingRepository meetingRepository,
                             MeetingAttendeeRepository meetingAttendeeRepository,
                             MeetingActionItemRepository actionItemRepository,
                             AccessGuardService guardService,
                             OutboxService outboxService) {
        this.meetingRepository = meetingRepository;
        this.meetingAttendeeRepository = meetingAttendeeRepository;
        this.actionItemRepository = actionItemRepository;
        this.guardService = guardService;
        this.outboxService = outboxService;
    }

    @GetMapping("/api/projects/{projectId}/meetings")
    public ApiSuccess<List<MeetingEntity>> list(@PathVariable UUID projectId) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMember(projectId, principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(meetingRepository.findByProjectIdAndTenantIdAndDeletedAtIsNull(projectId, principal.getTenantId()));
    }

    @PostMapping("/api/projects/{projectId}/meetings")
    public ApiSuccess<MeetingEntity> create(@PathVariable UUID projectId, @RequestBody @Valid CreateMeetingRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER, MemberRole.CLIENT_OWNER));
        MeetingEntity meeting = new MeetingEntity();
        meeting.setTenantId(principal.getTenantId());
        meeting.setProjectId(projectId);
        meeting.setTitle(request.title());
        meeting.setStartAt(request.startAt());
        meeting.setEndAt(request.endAt());
        meeting.setMeetUrl(request.meetUrl());
        meeting.setStatus(MeetingStatus.SCHEDULED);
        meeting.setCreatedBy(principal.getUserId());
        meeting.setUpdatedBy(principal.getUserId());
        MeetingEntity saved = meetingRepository.save(meeting);
        outboxService.publish(principal.getTenantId(), principal.getUserId(), "meeting", saved.getId(),
                "meeting.created", "Meeting created", saved.getTitle(), Map.of("projectId", projectId));
        return ApiSuccess.of(saved);
    }

    @PatchMapping("/api/meetings/{meetingId}")
    public ApiSuccess<MeetingEntity> patch(@PathVariable UUID meetingId, @RequestBody PatchMeetingRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        MeetingEntity meeting = requireActiveMeeting(meetingId);
        guardService.requireProjectMemberRole(meeting.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        if (request.title() != null) {
            meeting.setTitle(request.title());
        }
        if (request.startAt() != null) {
            meeting.setStartAt(request.startAt());
        }
        if (request.endAt() != null) {
            meeting.setEndAt(request.endAt());
        }
        if (request.meetUrl() != null) {
            meeting.setMeetUrl(request.meetUrl());
        }
        if (request.status() != null) {
            meeting.setStatus(request.status());
        }
        meeting.setUpdatedBy(principal.getUserId());
        return ApiSuccess.of(meetingRepository.save(meeting));
    }

    @DeleteMapping("/api/meetings/{meetingId}")
    public ApiSuccess<Map<String, Object>> delete(@PathVariable UUID meetingId) {
        var principal = SecurityUtils.requirePrincipal();
        MeetingEntity meeting = requireActiveMeeting(meetingId);
        guardService.requireProjectMemberRole(meeting.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        meeting.setDeletedAt(OffsetDateTime.now());
        meeting.setUpdatedBy(principal.getUserId());
        meetingRepository.save(meeting);
        return ApiSuccess.of(Map.of("deleted", true));
    }

    @PostMapping("/api/projects/{projectId}/meetings/google")
    public ApiSuccess<Map<String, Object>> createGoogle(@PathVariable UUID projectId) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMember(projectId, principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(Map.of("code", "FEATURE_DISABLED", "message", "Google integration is disabled."));
    }

    @PostMapping("/api/meetings/{meetingId}/respond")
    public ApiSuccess<MeetingAttendeeEntity> respond(@PathVariable UUID meetingId, @RequestBody @Valid RespondRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        MeetingEntity meeting = requireActiveMeeting(meetingId);
        guardService.requireProjectMember(meeting.getProjectId(), principal.getUserId(), principal.getTenantId());
        MeetingAttendeeEntity attendee = meetingAttendeeRepository
                .findByMeetingIdAndUserIdAndTenantIdAndDeletedAtIsNull(meetingId, principal.getUserId(), principal.getTenantId())
                .orElseGet(() -> {
                    MeetingAttendeeEntity entity = new MeetingAttendeeEntity();
                    entity.setTenantId(principal.getTenantId());
                    entity.setMeetingId(meetingId);
                    entity.setUserId(principal.getUserId());
                    entity.setCreatedBy(principal.getUserId());
                    return entity;
                });
        attendee.setResponse(request.response());
        attendee.setUpdatedBy(principal.getUserId());
        MeetingAttendeeEntity saved = meetingAttendeeRepository.save(attendee);
        outboxService.publish(principal.getTenantId(), principal.getUserId(), "meeting", meeting.getId(),
                "meeting.responded", "Meeting response", request.response().name(), Map.of("meetingId", meetingId));
        return ApiSuccess.of(saved);
    }

    @PostMapping("/api/meetings/{meetingId}/action-items")
    public ApiSuccess<MeetingActionItemEntity> createActionItem(@PathVariable UUID meetingId, @RequestBody @Valid ActionItemRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        MeetingEntity meeting = requireActiveMeeting(meetingId);
        guardService.requireProjectMember(meeting.getProjectId(), principal.getUserId(), principal.getTenantId());
        MeetingActionItemEntity item = new MeetingActionItemEntity();
        item.setTenantId(principal.getTenantId());
        item.setMeetingId(meetingId);
        item.setTitle(request.title());
        item.setAssigneeUserId(request.assigneeUserId());
        item.setDueAt(request.dueAt());
        item.setDone(false);
        item.setCreatedBy(principal.getUserId());
        item.setUpdatedBy(principal.getUserId());
        return ApiSuccess.of(actionItemRepository.save(item));
    }

    @PatchMapping("/api/meeting-action-items/{id}")
    public ApiSuccess<MeetingActionItemEntity> patchActionItem(@PathVariable UUID id, @RequestBody ActionItemPatch request) {
        var principal = SecurityUtils.requirePrincipal();
        MeetingActionItemEntity item = actionItemRepository.findById(id)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "ACTION_ITEM_NOT_FOUND", "액션 아이템을 찾을 수 없습니다."));
        MeetingEntity meeting = requireActiveMeeting(item.getMeetingId());
        guardService.requireProjectMember(meeting.getProjectId(), principal.getUserId(), principal.getTenantId());
        if (request.title() != null) item.setTitle(request.title());
        if (request.done() != null) item.setDone(request.done());
        if (request.dueAt() != null) item.setDueAt(request.dueAt());
        item.setUpdatedBy(principal.getUserId());
        return ApiSuccess.of(actionItemRepository.save(item));
    }

    @DeleteMapping("/api/meeting-action-items/{id}")
    public ApiSuccess<Map<String, Object>> deleteActionItem(@PathVariable UUID id) {
        var principal = SecurityUtils.requirePrincipal();
        MeetingActionItemEntity item = actionItemRepository.findById(id)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "ACTION_ITEM_NOT_FOUND", "액션 아이템을 찾을 수 없습니다."));
        MeetingEntity meeting = requireActiveMeeting(item.getMeetingId());
        guardService.requireProjectMember(meeting.getProjectId(), principal.getUserId(), principal.getTenantId());
        item.setDeletedAt(OffsetDateTime.now());
        item.setUpdatedBy(principal.getUserId());
        actionItemRepository.save(item);
        return ApiSuccess.of(Map.of("deleted", true));
    }

    private MeetingEntity requireActiveMeeting(UUID meetingId) {
        MeetingEntity meeting = meetingRepository.findById(meetingId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "MEETING_NOT_FOUND", "회의를 찾을 수 없습니다."));
        if (meeting.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "MEETING_NOT_FOUND", "회의를 찾을 수 없습니다.");
        }
        return meeting;
    }

    public record CreateMeetingRequest(@NotBlank String title, OffsetDateTime startAt, OffsetDateTime endAt, String meetUrl) {
    }

    public record PatchMeetingRequest(String title, OffsetDateTime startAt, OffsetDateTime endAt, String meetUrl, MeetingStatus status) {
    }

    public record RespondRequest(AttendeeResponse response) {
    }

    public record ActionItemRequest(@NotBlank String title, UUID assigneeUserId, OffsetDateTime dueAt) {
    }

    public record ActionItemPatch(String title, Boolean done, OffsetDateTime dueAt) {
    }
}
