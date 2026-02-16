package com.bridge.backend.domain.notification;

import com.bridge.backend.common.api.ApiSuccess;
import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.MemberRole;
import com.bridge.backend.common.security.SecurityUtils;
import com.bridge.backend.domain.admin.TenantMemberRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationRepository notificationRepository;
    private final OutboxEventRepository outboxEventRepository;
    private final TenantMemberRepository tenantMemberRepository;
    private final ObjectMapper objectMapper;
    private final NotificationStreamService streamService;

    public NotificationController(NotificationRepository notificationRepository,
                                  OutboxEventRepository outboxEventRepository,
                                  TenantMemberRepository tenantMemberRepository,
                                  ObjectMapper objectMapper,
                                  NotificationStreamService streamService) {
        this.notificationRepository = notificationRepository;
        this.outboxEventRepository = outboxEventRepository;
        this.tenantMemberRepository = tenantMemberRepository;
        this.objectMapper = objectMapper;
        this.streamService = streamService;
    }

    @GetMapping
    public ApiSuccess<List<NotificationEntity>> list() {
        var principal = SecurityUtils.requirePrincipal();
        return ApiSuccess.of(notificationRepository.findByUserIdAndTenantIdAndDeletedAtIsNullOrderByCreatedAtDesc(
                principal.getUserId(), principal.getTenantId()
        ));
    }

    @PostMapping("/{id}/read")
    public ApiSuccess<Map<String, Object>> read(@PathVariable UUID id) {
        var principal = SecurityUtils.requirePrincipal();
        NotificationEntity notification = notificationRepository.findById(id).orElseThrow();
        if (!notification.getUserId().equals(principal.getUserId())) {
            throw new AppException(HttpStatus.FORBIDDEN, "FORBIDDEN", "다른 사용자의 알림입니다.");
        }
        notification.setReadAt(OffsetDateTime.now());
        notification.setUpdatedBy(principal.getUserId());
        notificationRepository.save(notification);
        streamService.send(principal.getUserId(), "notification.read", Map.of("id", notification.getId()));
        return ApiSuccess.of(Map.of("read", true));
    }

    @GetMapping("/stream")
    public SseEmitter stream() {
        return streamService.connect(SecurityUtils.currentUserId());
    }

    @GetMapping("/pm-events")
    public ApiSuccess<List<Map<String, Object>>> pmEvents(@RequestParam(required = false) UUID projectId) {
        var principal = SecurityUtils.requirePrincipal();
        boolean isPlatformAdmin = principal.getRoles().contains("PLATFORM_ADMIN");
        if (!isPlatformAdmin) {
            var currentMember = tenantMemberRepository
                    .findByTenantIdAndUserIdAndDeletedAtIsNull(principal.getTenantId(), principal.getUserId())
                    .orElseThrow(() -> new AppException(HttpStatus.FORBIDDEN, "FORBIDDEN", "권한이 없습니다."));
            if (!isPmRole(currentMember.getRole())) {
                throw new AppException(HttpStatus.FORBIDDEN, "FORBIDDEN", "권한이 없습니다.");
            }
        }
        List<Map<String, Object>> events = outboxEventRepository
                .findTop200ByTenantIdAndDeletedAtIsNullOrderByCreatedAtDesc(principal.getTenantId())
                .stream()
                .map(event -> toPmEvent(event, projectId))
                .filter(event -> event != null)
                .collect(Collectors.toList());
        return ApiSuccess.of(events);
    }

    private Map<String, Object> toPmEvent(OutboxEventEntity event, UUID projectIdFilter) {
        Map<String, Object> payload = parsePayload(event.getEventPayload());
        UUID eventProjectId = extractProjectId(payload.get("payload"));
        if (projectIdFilter != null && !projectIdFilter.equals(eventProjectId)) {
            return null;
        }
        Object actorRaw = payload.get("userId");
        if (actorRaw == null) {
            return null;
        }
        UUID actorUserId = UUID.fromString(String.valueOf(actorRaw));
        var actorMember = tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(event.getTenantId(), actorUserId).orElse(null);
        if (actorMember == null || !isPmRole(actorMember.getRole())) {
            return null;
        }
        return Map.of(
                "id", event.getId(),
                "eventType", event.getEventType(),
                "aggregateType", event.getAggregateType(),
                "aggregateId", event.getAggregateId(),
                "title", String.valueOf(payload.getOrDefault("title", "")),
                "message", String.valueOf(payload.getOrDefault("message", "")),
                "actorUserId", actorUserId,
                "actorRole", actorMember.getRole().name(),
                "projectId", eventProjectId,
                "createdAt", event.getCreatedAt()
        );
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parsePayload(String raw) {
        try {
            return objectMapper.readValue(raw, Map.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private boolean isPmRole(MemberRole role) {
        return role == MemberRole.PM_OWNER || role == MemberRole.PM_MEMBER;
    }

    @SuppressWarnings("unchecked")
    private UUID extractProjectId(Object payloadRaw) {
        if (!(payloadRaw instanceof Map<?, ?> payloadMap)) {
            return null;
        }
        Object projectId = payloadMap.get("projectId");
        if (projectId == null) {
            return null;
        }
        try {
            return UUID.fromString(String.valueOf(projectId));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
