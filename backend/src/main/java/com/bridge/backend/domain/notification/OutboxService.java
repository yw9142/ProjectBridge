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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

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
        outbox.setEventPayload(toJson(Map.of(
                "title", title,
                "message", message,
                "payload", payload,
                "userId", userId.toString()
        )));
        outboxEventRepository.save(outbox);
    }

    @Scheduled(fixedDelay = 1000L)
    @Transactional
    public void consume() {
        List<UUID> claimedIds = outboxEventRepository.claimUnprocessedBatchForUpdate(100);
        if (claimedIds.isEmpty()) {
            return;
        }
        outboxEventRepository.findByIdInOrderByCreatedAtAsc(claimedIds).forEach(event -> {
            Map<String, Object> payload = parseJson(event.getEventPayload());
            UUID actorUserId = UUID.fromString(String.valueOf(payload.get("userId")));
            TenantMemberEntity actorMember = tenantMemberRepository
                    .findByTenantIdAndUserIdAndDeletedAtIsNull(event.getTenantId(), actorUserId)
                    .orElse(null);
            UUID projectId = extractProjectId(payload.get("payload"));

            List<RecipientTarget> recipients = resolveRecipientTargets(event.getTenantId(), actorUserId, actorMember, projectId);
            for (RecipientTarget recipient : recipients) {
                createNotification(event, recipient, payload);
            }

            event.setProcessedAt(OffsetDateTime.now());
            outboxEventRepository.save(event);
        });
    }

    private List<RecipientTarget> resolveRecipientTargets(UUID tenantId,
                                                          UUID actorUserId,
                                                          TenantMemberEntity actorMember,
                                                          UUID projectId) {
        if (projectId != null) {
            List<ProjectMemberEntity> members = projectMemberRepository.findByProjectIdAndDeletedAtIsNull(projectId)
                    .stream()
                    .filter(member -> tenantId.equals(member.getTenantId()))
                    .filter(member -> !member.getUserId().equals(actorUserId))
                    .toList();
            if (members.isEmpty()) {
                return List.of();
            }

            if (actorMember != null && isPmRole(actorMember.getRole())) {
                return members.stream()
                        .filter(member -> isClientRole(member.getRole()))
                        .map(member -> new RecipientTarget(member.getUserId(), toAppScope(member.getRole())))
                        .distinct()
                        .collect(Collectors.toList());
            }
            if (actorMember != null && isClientRole(actorMember.getRole())) {
                return members.stream()
                        .filter(member -> isPmRole(member.getRole()))
                        .map(member -> new RecipientTarget(member.getUserId(), toAppScope(member.getRole())))
                        .distinct()
                        .collect(Collectors.toList());
            }

            return members.stream()
                    .map(member -> new RecipientTarget(member.getUserId(), toAppScope(member.getRole())))
                    .distinct()
                    .collect(Collectors.toList());
        }

        List<TenantMemberEntity> tenantMembers = tenantMemberRepository.findByTenantIdAndDeletedAtIsNull(tenantId)
                .stream()
                .filter(member -> !member.getUserId().equals(actorUserId))
                .toList();
        if (tenantMembers.isEmpty()) {
            return List.of();
        }

        if (actorMember != null && isPmRole(actorMember.getRole())) {
            return tenantMembers.stream()
                    .filter(member -> isClientRole(member.getRole()))
                    .map(member -> new RecipientTarget(member.getUserId(), toAppScope(member.getRole())))
                    .distinct()
                    .collect(Collectors.toList());
        }
        if (actorMember != null && isClientRole(actorMember.getRole())) {
            return tenantMembers.stream()
                    .filter(member -> isPmRole(member.getRole()))
                    .map(member -> new RecipientTarget(member.getUserId(), toAppScope(member.getRole())))
                    .distinct()
                    .collect(Collectors.toList());
        }

        return tenantMembers.stream()
                .map(member -> new RecipientTarget(member.getUserId(), toAppScope(member.getRole())))
                .distinct()
                .collect(Collectors.toList());
    }

    private void createNotification(OutboxEventEntity event, RecipientTarget recipient, Map<String, Object> payload) {
        String rawEventType = event.getEventType();
        String localizedTitle = NotificationTextLocalizer.localizeTitle(rawEventType, String.valueOf(payload.get("title")));
        String localizedMessage = NotificationTextLocalizer.localizeMessage(rawEventType, String.valueOf(payload.get("message")));
        String localizedEventType = NotificationTextLocalizer.localizeEventType(rawEventType);

        NotificationEntity notification = new NotificationEntity();
        notification.setTenantId(event.getTenantId());
        notification.setUserId(recipient.userId());
        notification.setEventType(rawEventType);
        notification.setTitle(localizedTitle);
        notification.setMessage(localizedMessage);
        notificationRepository.save(notification);

        notificationStreamService.sendToScope(event.getTenantId(), recipient.userId(), recipient.appScope(), "notification.created", Map.of(
                "id", notification.getId(),
                "title", notification.getTitle(),
                "message", notification.getMessage(),
                "eventType", localizedEventType,
                "createdAt", notification.getCreatedAt()
        ));
    }

    private boolean isClientRole(MemberRole role) {
        return role == MemberRole.CLIENT_OWNER || role == MemberRole.CLIENT_MEMBER;
    }

    private boolean isPmRole(MemberRole role) {
        return role == MemberRole.PM_OWNER || role == MemberRole.PM_MEMBER;
    }

    private String toAppScope(MemberRole role) {
        if (role == MemberRole.CLIENT_OWNER || role == MemberRole.CLIENT_MEMBER) {
            return "client";
        }
        return "pm";
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

    private record RecipientTarget(UUID userId, String appScope) {
    }
}
