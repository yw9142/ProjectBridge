package com.bridge.backend.domain.notification;

import com.bridge.backend.common.model.enums.MemberRole;
import com.bridge.backend.domain.admin.TenantMemberEntity;
import com.bridge.backend.domain.admin.TenantMemberRepository;
import com.bridge.backend.domain.project.ProjectMemberEntity;
import com.bridge.backend.domain.project.ProjectMemberRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class OutboxService {
    private final OutboxEventRepository outboxEventRepository;
    private final NotificationRepository notificationRepository;
    private final NotificationStreamService notificationStreamService;
    private final TenantMemberRepository tenantMemberRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ObjectMapper objectMapper;

    public OutboxService(OutboxEventRepository outboxEventRepository,
                         NotificationRepository notificationRepository,
                         NotificationStreamService notificationStreamService,
                         TenantMemberRepository tenantMemberRepository,
                         ProjectMemberRepository projectMemberRepository,
                         ObjectMapper objectMapper) {
        this.outboxEventRepository = outboxEventRepository;
        this.notificationRepository = notificationRepository;
        this.notificationStreamService = notificationStreamService;
        this.tenantMemberRepository = tenantMemberRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void publish(UUID tenantId, UUID userId, String aggregateType, UUID aggregateId, String eventType, String title, String message, Object payload) {
        OutboxEventEntity outbox = new OutboxEventEntity();
        outbox.setTenantId(tenantId);
        outbox.setAggregateType(aggregateType);
        outbox.setAggregateId(aggregateId);
        outbox.setEventType(eventType);
        outbox.setEventPayload(toJson(buildOutboxPayload(userId, title, message, payload)));
        outboxEventRepository.save(outbox);
    }

    @Scheduled(fixedDelay = 1000L)
    @Transactional
    public void consume() {
        outboxEventRepository.findTop100ByProcessedAtIsNullOrderByCreatedAtAsc().forEach(evt -> {
            Map<String, Object> payload = parseJson(evt.getEventPayload());
            UUID actorUserId = extractActorUserId(payload.get("userId"));
            UUID projectId = extractProjectId(payload.get("payload"));

            TenantMemberEntity actorMember = null;
            if (actorUserId != null) {
                actorMember = tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(evt.getTenantId(), actorUserId).orElse(null);
            }

            Set<UUID> recipients = resolveRecipients(evt.getTenantId(), projectId, actorUserId, actorMember);
            for (UUID recipientId : recipients) {
                createNotification(evt, recipientId, payload);
            }

            evt.setProcessedAt(OffsetDateTime.now());
            outboxEventRepository.save(evt);
        });
    }

    private Set<UUID> resolveRecipients(UUID tenantId, UUID projectId, UUID actorUserId, TenantMemberEntity actorMember) {
        boolean actorIsClient = actorMember != null && isClientRole(actorMember.getRole());
        boolean actorIsPm = actorMember != null && isPmRole(actorMember.getRole());

        List<UUID> rawRecipients;
        if (projectId != null) {
            List<ProjectMemberEntity> projectMembers = projectMemberRepository.findByProjectIdAndDeletedAtIsNull(projectId);
            rawRecipients = new ArrayList<>();
            for (ProjectMemberEntity member : projectMembers) {
                if (!tenantId.equals(member.getTenantId())) {
                    continue;
                }
                if (actorIsClient && !isPmRole(member.getRole())) {
                    continue;
                }
                if (actorIsPm && !isClientRole(member.getRole())) {
                    continue;
                }
                rawRecipients.add(member.getUserId());
            }
        } else {
            List<TenantMemberEntity> tenantMembers = tenantMemberRepository.findByTenantIdAndDeletedAtIsNull(tenantId);
            rawRecipients = new ArrayList<>();
            for (TenantMemberEntity member : tenantMembers) {
                if (actorIsClient && !isPmRole(member.getRole())) {
                    continue;
                }
                if (actorIsPm && !isClientRole(member.getRole())) {
                    continue;
                }
                rawRecipients.add(member.getUserId());
            }
        }

        Set<UUID> recipients = new HashSet<>(rawRecipients);
        if (actorUserId != null) {
            recipients.remove(actorUserId);
        }
        return recipients;
    }

    private void createNotification(OutboxEventEntity event, UUID recipientId, Map<String, Object> payload) {
        String rawEventType = event.getEventType();
        String localizedTitle = NotificationTextLocalizer.localizeTitle(rawEventType, String.valueOf(payload.getOrDefault("title", "")));
        String localizedMessage = NotificationTextLocalizer.localizeMessage(rawEventType, String.valueOf(payload.getOrDefault("message", "")));
        String localizedEventType = NotificationTextLocalizer.localizeEventType(rawEventType);

        NotificationEntity notification = new NotificationEntity();
        notification.setTenantId(event.getTenantId());
        notification.setUserId(recipientId);
        notification.setEventType(rawEventType);
        notification.setTitle(localizedTitle);
        notification.setMessage(localizedMessage);
        notificationRepository.save(notification);

        notificationStreamService.send(recipientId, "notification.created", Map.of(
                "id", notification.getId(),
                "title", notification.getTitle(),
                "message", notification.getMessage(),
                "eventType", localizedEventType,
                "createdAt", notification.getCreatedAt()
        ));
    }

    private Map<String, Object> buildOutboxPayload(UUID userId, String title, String message, Object payload) {
        var values = new java.util.HashMap<String, Object>();
        values.put("title", title);
        values.put("message", message);
        values.put("payload", payload);
        values.put("userId", userId == null ? null : userId.toString());
        return values;
    }

    private UUID extractActorUserId(Object userIdRaw) {
        if (userIdRaw == null) {
            return null;
        }
        try {
            return UUID.fromString(String.valueOf(userIdRaw));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private boolean isClientRole(MemberRole role) {
        return role == MemberRole.CLIENT_OWNER || role == MemberRole.CLIENT_MEMBER;
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

    private String toJson(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJson(String json) {
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
