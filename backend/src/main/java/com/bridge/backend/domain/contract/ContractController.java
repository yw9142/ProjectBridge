package com.bridge.backend.domain.contract;

import com.bridge.backend.common.api.ApiSuccess;
import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.ContractStatus;
import com.bridge.backend.common.model.enums.EnvelopeStatus;
import com.bridge.backend.common.model.enums.MemberRole;
import com.bridge.backend.common.model.enums.SignatureEventType;
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
public class ContractController {
    private final ContractRepository contractRepository;
    private final EnvelopeRepository envelopeRepository;
    private final SignatureRecipientRepository recipientRepository;
    private final SignatureFieldRepository fieldRepository;
    private final SignatureEventRepository eventRepository;
    private final AccessGuardService guardService;
    private final OutboxService outboxService;

    public ContractController(ContractRepository contractRepository,
                              EnvelopeRepository envelopeRepository,
                              SignatureRecipientRepository recipientRepository,
                              SignatureFieldRepository fieldRepository,
                              SignatureEventRepository eventRepository,
                              AccessGuardService guardService,
                              OutboxService outboxService) {
        this.contractRepository = contractRepository;
        this.envelopeRepository = envelopeRepository;
        this.recipientRepository = recipientRepository;
        this.fieldRepository = fieldRepository;
        this.eventRepository = eventRepository;
        this.guardService = guardService;
        this.outboxService = outboxService;
    }

    @GetMapping("/api/projects/{projectId}/contracts")
    public ApiSuccess<List<ContractEntity>> contracts(@PathVariable UUID projectId) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMember(projectId, principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(contractRepository.findByProjectIdAndTenantIdAndDeletedAtIsNull(projectId, principal.getTenantId()));
    }

    @PostMapping("/api/projects/{projectId}/contracts")
    public ApiSuccess<ContractEntity> createContract(@PathVariable UUID projectId, @RequestBody @Valid CreateContractRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        ContractEntity contract = new ContractEntity();
        contract.setTenantId(principal.getTenantId());
        contract.setProjectId(projectId);
        contract.setName(request.name());
        contract.setFileVersionId(request.fileVersionId());
        contract.setCreatedBy(principal.getUserId());
        contract.setUpdatedBy(principal.getUserId());
        return ApiSuccess.of(contractRepository.save(contract));
    }

    @PatchMapping("/api/contracts/{contractId}")
    public ApiSuccess<ContractEntity> patchContract(@PathVariable UUID contractId, @RequestBody PatchContractRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        ContractEntity contract = requireActiveContract(contractId);
        guardService.requireProjectMemberRole(contract.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        if (request.name() != null) {
            contract.setName(request.name());
        }
        if (Boolean.TRUE.equals(request.clearFileVersion())) {
            contract.setFileVersionId(null);
        } else if (request.fileVersionId() != null) {
            contract.setFileVersionId(request.fileVersionId());
        }
        if (request.status() != null) {
            contract.setStatus(request.status());
        }
        contract.setUpdatedBy(principal.getUserId());
        return ApiSuccess.of(contractRepository.save(contract));
    }

    @DeleteMapping("/api/contracts/{contractId}")
    public ApiSuccess<Map<String, Object>> deleteContract(@PathVariable UUID contractId) {
        var principal = SecurityUtils.requirePrincipal();
        ContractEntity contract = requireActiveContract(contractId);
        guardService.requireProjectMemberRole(contract.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        contract.setDeletedAt(OffsetDateTime.now());
        contract.setUpdatedBy(principal.getUserId());
        contractRepository.save(contract);
        return ApiSuccess.of(Map.of("deleted", true));
    }

    @PatchMapping("/api/contracts/{contractId}/review")
    public ApiSuccess<ContractEntity> reviewContract(@PathVariable UUID contractId, @RequestBody @Valid ReviewContractRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        ContractEntity contract = requireActiveContract(contractId);
        guardService.requireProjectMemberRole(contract.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.CLIENT_OWNER, MemberRole.CLIENT_MEMBER));
        contract.setStatus(Boolean.TRUE.equals(request.approved()) ? ContractStatus.ACTIVE : ContractStatus.ARCHIVED);
        contract.setUpdatedBy(principal.getUserId());
        ContractEntity saved = contractRepository.save(contract);
        outboxService.publish(principal.getTenantId(), principal.getUserId(), "contract", saved.getId(),
                "contract.reviewed", "Contract reviewed", saved.getStatus().name(), Map.of("contractId", saved.getId()));
        return ApiSuccess.of(saved);
    }

    @GetMapping("/api/contracts/{contractId}/envelopes")
    public ApiSuccess<List<EnvelopeEntity>> envelopes(@PathVariable UUID contractId) {
        var principal = SecurityUtils.requirePrincipal();
        ContractEntity contract = requireActiveContract(contractId);
        guardService.requireProjectMember(contract.getProjectId(), principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(envelopeRepository.findByContractIdAndTenantIdAndDeletedAtIsNull(contractId, principal.getTenantId()));
    }

    @PostMapping("/api/contracts/{contractId}/envelopes")
    public ApiSuccess<EnvelopeEntity> createEnvelope(@PathVariable UUID contractId, @RequestBody @Valid CreateEnvelopeRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        ContractEntity contract = requireActiveContract(contractId);
        guardService.requireProjectMemberRole(contract.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        EnvelopeEntity envelope = new EnvelopeEntity();
        envelope.setTenantId(principal.getTenantId());
        envelope.setContractId(contractId);
        envelope.setTitle(request.title());
        envelope.setCreatedBy(principal.getUserId());
        envelope.setUpdatedBy(principal.getUserId());
        return ApiSuccess.of(envelopeRepository.save(envelope));
    }

    @PostMapping("/api/envelopes/{envelopeId}/recipients")
    public ApiSuccess<SignatureRecipientEntity> addRecipient(@PathVariable UUID envelopeId, @RequestBody @Valid AddRecipientRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        EnvelopeEntity envelope = requireActiveEnvelope(envelopeId);
        ContractEntity contract = requireActiveContract(envelope.getContractId());
        guardService.requireProjectMember(contract.getProjectId(), principal.getUserId(), principal.getTenantId());
        SignatureRecipientEntity recipient = new SignatureRecipientEntity();
        recipient.setTenantId(principal.getTenantId());
        recipient.setEnvelopeId(envelopeId);
        recipient.setRecipientEmail(request.email());
        recipient.setRecipientName(request.name());
        recipient.setSigningOrder(request.signingOrder() == null ? 1 : request.signingOrder());
        recipient.setRecipientToken(UUID.randomUUID().toString().replace("-", ""));
        recipient.setCreatedBy(principal.getUserId());
        recipient.setUpdatedBy(principal.getUserId());
        return ApiSuccess.of(recipientRepository.save(recipient));
    }

    @PostMapping("/api/envelopes/{envelopeId}/fields")
    public ApiSuccess<SignatureFieldEntity> addField(@PathVariable UUID envelopeId, @RequestBody @Valid AddFieldRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        EnvelopeEntity envelope = requireActiveEnvelope(envelopeId);
        ContractEntity contract = requireActiveContract(envelope.getContractId());
        guardService.requireProjectMember(contract.getProjectId(), principal.getUserId(), principal.getTenantId());
        SignatureFieldEntity field = new SignatureFieldEntity();
        field.setTenantId(principal.getTenantId());
        field.setEnvelopeId(envelopeId);
        field.setRecipientId(request.recipientId());
        field.setType(request.type());
        field.setPage(request.page());
        field.setCoordX(request.coordX());
        field.setCoordY(request.coordY());
        field.setCoordW(request.coordW());
        field.setCoordH(request.coordH());
        field.setCreatedBy(principal.getUserId());
        field.setUpdatedBy(principal.getUserId());
        return ApiSuccess.of(fieldRepository.save(field));
    }

    @PostMapping("/api/envelopes/{envelopeId}/send")
    public ApiSuccess<EnvelopeEntity> send(@PathVariable UUID envelopeId) {
        var principal = SecurityUtils.requirePrincipal();
        EnvelopeEntity envelope = requireActiveEnvelope(envelopeId);
        ContractEntity contract = requireActiveContract(envelope.getContractId());
        guardService.requireProjectMemberRole(contract.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        envelope.setStatus(EnvelopeStatus.SENT);
        envelope.setSentAt(OffsetDateTime.now());
        envelope.setUpdatedBy(principal.getUserId());
        EnvelopeEntity saved = envelopeRepository.save(envelope);
        createEvent(saved, null, SignatureEventType.SENT, Map.of("envelopeId", saved.getId()));
        outboxService.publish(principal.getTenantId(), principal.getUserId(), "envelope", saved.getId(),
                "signature.sent", "Signature sent", saved.getTitle(), Map.of("envelopeId", saved.getId()));
        return ApiSuccess.of(saved);
    }

    @GetMapping("/api/envelopes/{envelopeId}")
    public ApiSuccess<Map<String, Object>> getEnvelope(@PathVariable UUID envelopeId) {
        var principal = SecurityUtils.requirePrincipal();
        EnvelopeEntity envelope = requireActiveEnvelope(envelopeId);
        ContractEntity contract = requireActiveContract(envelope.getContractId());
        guardService.requireProjectMember(contract.getProjectId(), principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(Map.of(
                "envelope", envelope,
                "recipients", recipientRepository.findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(envelopeId, principal.getTenantId()),
                "fields", fieldRepository.findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(envelopeId, principal.getTenantId())
        ));
    }

    @GetMapping("/api/envelopes/{envelopeId}/events")
    public ApiSuccess<List<SignatureEventEntity>> events(@PathVariable UUID envelopeId) {
        var principal = SecurityUtils.requirePrincipal();
        EnvelopeEntity envelope = requireActiveEnvelope(envelopeId);
        ContractEntity contract = requireActiveContract(envelope.getContractId());
        guardService.requireProjectMember(contract.getProjectId(), principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(eventRepository.findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(envelopeId, principal.getTenantId()));
    }

    @PostMapping("/api/envelopes/{envelopeId}/void")
    public ApiSuccess<EnvelopeEntity> voidEnvelope(@PathVariable UUID envelopeId) {
        var principal = SecurityUtils.requirePrincipal();
        EnvelopeEntity envelope = requireActiveEnvelope(envelopeId);
        ContractEntity contract = requireActiveContract(envelope.getContractId());
        guardService.requireProjectMemberRole(contract.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        envelope.setStatus(EnvelopeStatus.VOIDED);
        envelope.setUpdatedBy(principal.getUserId());
        EnvelopeEntity saved = envelopeRepository.save(envelope);
        createEvent(saved, null, SignatureEventType.VOIDED, Map.of("envelopeId", saved.getId()));
        return ApiSuccess.of(saved);
    }

    private ContractEntity requireActiveContract(UUID contractId) {
        ContractEntity contract = contractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND", "계약을 찾을 수 없습니다."));
        if (contract.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND", "계약을 찾을 수 없습니다.");
        }
        return contract;
    }

    private EnvelopeEntity requireActiveEnvelope(UUID envelopeId) {
        EnvelopeEntity envelope = envelopeRepository.findById(envelopeId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "ENVELOPE_NOT_FOUND", "Envelope를 찾을 수 없습니다."));
        if (envelope.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "ENVELOPE_NOT_FOUND", "Envelope를 찾을 수 없습니다.");
        }
        return envelope;
    }

    private void createEvent(EnvelopeEntity envelope, UUID recipientId, SignatureEventType eventType, Object payload) {
        SignatureEventEntity event = new SignatureEventEntity();
        event.setTenantId(envelope.getTenantId());
        event.setEnvelopeId(envelope.getId());
        event.setRecipientId(recipientId);
        event.setEventType(eventType);
        event.setEventPayload(String.valueOf(payload));
        event.setCreatedBy(SecurityUtils.currentUserId());
        event.setUpdatedBy(SecurityUtils.currentUserId());
        eventRepository.save(event);
    }

    public record CreateContractRequest(@NotBlank String name, UUID fileVersionId) {
    }

    public record PatchContractRequest(String name, UUID fileVersionId, Boolean clearFileVersion, ContractStatus status) {
    }

    public record CreateEnvelopeRequest(@NotBlank String title) {
    }

    public record AddRecipientRequest(@NotBlank String name, @NotBlank String email, Integer signingOrder) {
    }

    public record AddFieldRequest(UUID recipientId,
                                  com.bridge.backend.common.model.enums.SignatureFieldType type,
                                  int page, double coordX, double coordY, double coordW, double coordH) {
    }

    public record ReviewContractRequest(Boolean approved) {
    }
}
