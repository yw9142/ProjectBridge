package com.bridge.backend.domain.request;

import com.bridge.backend.common.api.ApiSuccess;
import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.MemberRole;
import com.bridge.backend.common.model.enums.RequestStatus;
import com.bridge.backend.common.model.enums.RequestType;
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
public class RequestController {
    private final RequestRepository requestRepository;
    private final RequestEventRepository requestEventRepository;
    private final AccessGuardService guardService;
    private final OutboxService outboxService;

    public RequestController(RequestRepository requestRepository,
                             RequestEventRepository requestEventRepository,
                             AccessGuardService guardService,
                             OutboxService outboxService) {
        this.requestRepository = requestRepository;
        this.requestEventRepository = requestEventRepository;
        this.guardService = guardService;
        this.outboxService = outboxService;
    }

    @GetMapping("/api/projects/{projectId}/requests")
    public ApiSuccess<List<RequestEntity>> list(@PathVariable UUID projectId) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMember(projectId, principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(requestRepository.findByProjectIdAndTenantIdAndDeletedAtIsNull(projectId, principal.getTenantId()));
    }

    @PostMapping("/api/projects/{projectId}/requests")
    public ApiSuccess<RequestEntity> create(@PathVariable UUID projectId, @RequestBody @Valid CreateRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER, MemberRole.CLIENT_OWNER, MemberRole.CLIENT_MEMBER));
        RequestEntity entity = new RequestEntity();
        entity.setTenantId(principal.getTenantId());
        entity.setProjectId(projectId);
        entity.setType(request.type());
        entity.setTitle(request.title());
        entity.setDescription(request.description());
        entity.setStatus(RequestStatus.DRAFT);
        entity.setAssigneeUserId(request.assigneeUserId());
        entity.setDueAt(request.dueAt());
        entity.setCreatedBy(principal.getUserId());
        entity.setUpdatedBy(principal.getUserId());
        RequestEntity saved = requestRepository.save(entity);
        createEvent(saved, principal.getUserId(), "REQUEST_CREATED", Map.of("status", saved.getStatus()));
        outboxService.publish(principal.getTenantId(), principal.getUserId(), "request", saved.getId(),
                "request.created", "Request created", saved.getTitle(), Map.of("projectId", projectId));
        return ApiSuccess.of(saved);
    }

    @GetMapping("/api/requests/{requestId}")
    public ApiSuccess<RequestEntity> get(@PathVariable UUID requestId) {
        var principal = SecurityUtils.requirePrincipal();
        RequestEntity entity = requireActiveRequest(requestId);
        guardService.requireProjectMember(entity.getProjectId(), principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(entity);
    }

    @PatchMapping("/api/requests/{requestId}")
    public ApiSuccess<RequestEntity> patch(@PathVariable UUID requestId, @RequestBody @Valid PatchRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        RequestEntity entity = requireActiveRequest(requestId);
        guardService.requireProjectMember(entity.getProjectId(), principal.getUserId(), principal.getTenantId());
        if (request.type() != null) entity.setType(request.type());
        if (request.title() != null) entity.setTitle(request.title());
        if (request.description() != null) entity.setDescription(request.description());
        if (request.assigneeUserId() != null) entity.setAssigneeUserId(request.assigneeUserId());
        if (request.dueAt() != null) entity.setDueAt(request.dueAt());
        if (request.status() != null) entity.setStatus(request.status());
        entity.setUpdatedBy(principal.getUserId());
        return ApiSuccess.of(requestRepository.save(entity));
    }

    @PatchMapping("/api/requests/{requestId}/status")
    public ApiSuccess<RequestEntity> patchStatus(@PathVariable UUID requestId, @RequestBody @Valid StatusRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        RequestEntity entity = requireActiveRequest(requestId);
        guardService.requireProjectMember(entity.getProjectId(), principal.getUserId(), principal.getTenantId());
        entity.setStatus(request.status());
        entity.setUpdatedBy(principal.getUserId());
        RequestEntity saved = requestRepository.save(entity);
        createEvent(saved, principal.getUserId(), "REQUEST_STATUS_CHANGED", Map.of("status", saved.getStatus()));
        outboxService.publish(principal.getTenantId(), principal.getUserId(), "request", saved.getId(),
                "request.status.changed", "Request status changed", saved.getStatus().name(), Map.of("requestId", saved.getId()));
        return ApiSuccess.of(saved);
    }

    @GetMapping("/api/requests/{requestId}/events")
    public ApiSuccess<List<RequestEventEntity>> events(@PathVariable UUID requestId) {
        var principal = SecurityUtils.requirePrincipal();
        RequestEntity entity = requireActiveRequest(requestId);
        guardService.requireProjectMember(entity.getProjectId(), principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(requestEventRepository.findByRequestIdAndTenantIdAndDeletedAtIsNull(requestId, principal.getTenantId()));
    }

    @DeleteMapping("/api/requests/{requestId}")
    public ApiSuccess<Map<String, Object>> delete(@PathVariable UUID requestId) {
        var principal = SecurityUtils.requirePrincipal();
        RequestEntity entity = requireActiveRequest(requestId);
        guardService.requireProjectMemberRole(entity.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        entity.setDeletedAt(OffsetDateTime.now());
        entity.setUpdatedBy(principal.getUserId());
        requestRepository.save(entity);
        return ApiSuccess.of(Map.of("deleted", true));
    }

    private RequestEntity requireActiveRequest(UUID requestId) {
        RequestEntity entity = requestRepository.findById(requestId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "REQUEST_NOT_FOUND", "요청을 찾을 수 없습니다."));
        if (entity.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "REQUEST_NOT_FOUND", "요청을 찾을 수 없습니다.");
        }
        return entity;
    }

    private void createEvent(RequestEntity request, UUID actorId, String eventType, Map<String, Object> payload) {
        RequestEventEntity event = new RequestEventEntity();
        event.setTenantId(request.getTenantId());
        event.setRequestId(request.getId());
        event.setEventType(eventType);
        event.setEventPayload(payload.toString());
        event.setCreatedBy(actorId);
        event.setUpdatedBy(actorId);
        requestEventRepository.save(event);
    }

    public record CreateRequest(RequestType type, @NotBlank String title, String description, UUID assigneeUserId, OffsetDateTime dueAt) {
    }

    public record StatusRequest(RequestStatus status) {
    }

    public record PatchRequest(RequestType type,
                               String title,
                               String description,
                               UUID assigneeUserId,
                               OffsetDateTime dueAt,
                               RequestStatus status) {
    }
}
