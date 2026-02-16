package com.bridge.backend.domain.decision;

import com.bridge.backend.common.api.ApiSuccess;
import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.DecisionStatus;
import com.bridge.backend.common.model.enums.MemberRole;
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
public class DecisionController {
    private final DecisionRepository decisionRepository;
    private final AccessGuardService guardService;
    private final OutboxService outboxService;

    public DecisionController(DecisionRepository decisionRepository,
                              AccessGuardService guardService,
                              OutboxService outboxService) {
        this.decisionRepository = decisionRepository;
        this.guardService = guardService;
        this.outboxService = outboxService;
    }

    @GetMapping("/api/projects/{projectId}/decisions")
    public ApiSuccess<List<DecisionEntity>> list(@PathVariable UUID projectId) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMember(projectId, principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(decisionRepository.findByProjectIdAndTenantIdAndDeletedAtIsNull(projectId, principal.getTenantId()));
    }

    @PostMapping("/api/projects/{projectId}/decisions")
    public ApiSuccess<DecisionEntity> create(@PathVariable UUID projectId, @RequestBody @Valid CreateDecision request) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER, MemberRole.CLIENT_OWNER));
        DecisionEntity entity = new DecisionEntity();
        entity.setTenantId(principal.getTenantId());
        entity.setProjectId(projectId);
        entity.setTitle(request.title());
        entity.setRationale(request.rationale());
        entity.setStatus(DecisionStatus.PROPOSED);
        entity.setRelatedFileVersionId(request.relatedFileVersionId());
        entity.setCreatedBy(principal.getUserId());
        entity.setUpdatedBy(principal.getUserId());
        DecisionEntity saved = decisionRepository.save(entity);
        outboxService.publish(principal.getTenantId(), principal.getUserId(), "decision", saved.getId(),
                "decision.created", "Decision created", saved.getTitle(), Map.of("projectId", projectId));
        return ApiSuccess.of(saved);
    }

    @PatchMapping("/api/decisions/{decisionId}/status")
    public ApiSuccess<DecisionEntity> patchStatus(@PathVariable UUID decisionId, @RequestBody @Valid UpdateStatus request) {
        var principal = SecurityUtils.requirePrincipal();
        DecisionEntity entity = requireActiveDecision(decisionId);
        guardService.requireProjectMemberRole(entity.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.CLIENT_OWNER));
        entity.setStatus(request.status());
        if (request.status() == DecisionStatus.APPROVED && request.relatedFileVersionId() != null) {
            entity.setRelatedFileVersionId(request.relatedFileVersionId());
        }
        entity.setUpdatedBy(principal.getUserId());
        DecisionEntity saved = decisionRepository.save(entity);
        outboxService.publish(principal.getTenantId(), principal.getUserId(), "decision", saved.getId(),
                "decision.status.changed", "Decision status changed", saved.getStatus().name(), Map.of("decisionId", saved.getId()));
        return ApiSuccess.of(saved);
    }

    @PatchMapping("/api/decisions/{decisionId}")
    public ApiSuccess<DecisionEntity> patch(@PathVariable UUID decisionId, @RequestBody PatchDecision request) {
        var principal = SecurityUtils.requirePrincipal();
        DecisionEntity entity = requireActiveDecision(decisionId);
        guardService.requireProjectMemberRole(entity.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER, MemberRole.CLIENT_OWNER));
        if (request.title() != null) {
            entity.setTitle(request.title());
        }
        if (request.rationale() != null) {
            entity.setRationale(request.rationale());
        }
        if (Boolean.TRUE.equals(request.clearRelatedFileVersion())) {
            entity.setRelatedFileVersionId(null);
        } else if (request.relatedFileVersionId() != null) {
            entity.setRelatedFileVersionId(request.relatedFileVersionId());
        }
        if (request.status() != null) {
            entity.setStatus(request.status());
        }
        entity.setUpdatedBy(principal.getUserId());
        return ApiSuccess.of(decisionRepository.save(entity));
    }

    @DeleteMapping("/api/decisions/{decisionId}")
    public ApiSuccess<Map<String, Object>> delete(@PathVariable UUID decisionId) {
        var principal = SecurityUtils.requirePrincipal();
        DecisionEntity entity = requireActiveDecision(decisionId);
        guardService.requireProjectMemberRole(entity.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        entity.setDeletedAt(OffsetDateTime.now());
        entity.setUpdatedBy(principal.getUserId());
        decisionRepository.save(entity);
        return ApiSuccess.of(Map.of("deleted", true));
    }

    private DecisionEntity requireActiveDecision(UUID decisionId) {
        DecisionEntity entity = decisionRepository.findById(decisionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "DECISION_NOT_FOUND", "결정을 찾을 수 없습니다."));
        if (entity.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "DECISION_NOT_FOUND", "결정을 찾을 수 없습니다.");
        }
        return entity;
    }

    public record CreateDecision(@NotBlank String title, String rationale, UUID relatedFileVersionId) {
    }

    public record UpdateStatus(DecisionStatus status, UUID relatedFileVersionId) {
    }

    public record PatchDecision(String title,
                                String rationale,
                                UUID relatedFileVersionId,
                                Boolean clearRelatedFileVersion,
                                DecisionStatus status) {
    }
}
