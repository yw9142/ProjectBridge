package com.bridge.backend.domain.contract;

import com.bridge.backend.common.api.ApiSuccess;
import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.ContractStatus;
import com.bridge.backend.common.model.enums.EnvelopeStatus;
import com.bridge.backend.common.model.enums.MemberRole;
import com.bridge.backend.common.model.enums.RecipientStatus;
import com.bridge.backend.common.model.enums.SignatureFieldType;
import com.bridge.backend.common.model.enums.SignatureEventType;
import com.bridge.backend.common.security.SecurityUtils;
import com.bridge.backend.common.tenant.AccessGuardService;
import com.bridge.backend.domain.auth.UserEntity;
import com.bridge.backend.domain.auth.UserRepository;
import com.bridge.backend.domain.notification.OutboxService;
import com.bridge.backend.domain.project.ProjectMemberEntity;
import com.bridge.backend.domain.project.ProjectMemberRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@RestController
public class ContractController {
    private final ContractRepository contractRepository;
    private final EnvelopeRepository envelopeRepository;
    private final SignatureRecipientRepository recipientRepository;
    private final SignatureFieldRepository fieldRepository;
    private final SignatureEventRepository eventRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final UserRepository userRepository;
    private final AccessGuardService guardService;
    private final OutboxService outboxService;

    public ContractController(ContractRepository contractRepository,
                              EnvelopeRepository envelopeRepository,
                              SignatureRecipientRepository recipientRepository,
                              SignatureFieldRepository fieldRepository,
                              SignatureEventRepository eventRepository,
                              ProjectMemberRepository projectMemberRepository,
                              UserRepository userRepository,
                              AccessGuardService guardService,
                              OutboxService outboxService) {
        this.contractRepository = contractRepository;
        this.envelopeRepository = envelopeRepository;
        this.recipientRepository = recipientRepository;
        this.fieldRepository = fieldRepository;
        this.eventRepository = eventRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.userRepository = userRepository;
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

    @GetMapping("/api/contracts/{contractId}/signer")
    public ApiSuccess<Map<String, Object>> signer(@PathVariable UUID contractId) {
        var principal = SecurityUtils.requirePrincipal();
        ContractEntity contract = requireActiveContract(contractId);
        guardService.requireProjectMember(contract.getProjectId(), principal.getUserId(), principal.getTenantId());

        Optional<EnvelopeEntity> envelope = findLatestEnvelope(contract.getId(), principal.getTenantId());
        if (envelope.isEmpty()) {
            return ApiSuccess.of(Map.of("assigned", false));
        }

        Optional<SignatureRecipientEntity> recipient = findLatestRecipient(envelope.get().getId(), principal.getTenantId());
        if (recipient.isEmpty()) {
            return ApiSuccess.of(Map.of(
                    "assigned", false,
                    "envelopeId", envelope.get().getId(),
                    "envelopeStatus", envelope.get().getStatus()
            ));
        }

        UserEntity me = guardService.requireUser(principal.getUserId());
        boolean myTurn = recipient.get().getRecipientEmail().equalsIgnoreCase(me.getEmail());
        List<SignatureFieldEntity> recipientFields = fieldRepository
                .findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(envelope.get().getId(), principal.getTenantId())
                .stream()
                .filter(item -> recipient.get().getId().equals(item.getRecipientId()))
                .toList();
        SignatureFieldEntity signatureField = recipientFields.stream()
                .filter(item -> item.getType() == SignatureFieldType.SIGNATURE || item.getType() == SignatureFieldType.INITIAL)
                .findFirst()
                .orElse(null);
        SignatureFieldEntity dateField = recipientFields.stream()
                .filter(item -> item.getType() == SignatureFieldType.DATE)
                .findFirst()
                .orElse(null);

        Map<String, Object> response = new HashMap<>();
        response.put("assigned", true);
        response.put("myTurn", myTurn);
        response.put("envelopeId", envelope.get().getId());
        response.put("envelopeStatus", envelope.get().getStatus());
        response.put("recipientId", recipient.get().getId());
        response.put("recipientName", recipient.get().getRecipientName());
        response.put("recipientEmail", recipient.get().getRecipientEmail());
        response.put("recipientStatus", recipient.get().getStatus());
        if (signatureField != null) {
            response.put("signatureField", toFieldPayload(signatureField));
        }
        if (dateField != null) {
            response.put("dateField", toFieldPayload(dateField));
        }
        return ApiSuccess.of(response);
    }

    @PostMapping("/api/contracts/{contractId}/signer")
    @Transactional
    public ApiSuccess<Map<String, Object>> assignSigner(@PathVariable UUID contractId, @RequestBody @Valid AssignSignerRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        ContractEntity contract = requireActiveContract(contractId);
        guardService.requireProjectMemberRole(contract.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        if (request.signerUserId() == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, "SIGNER_REQUIRED", "Signer user id is required.");
        }
        if (contract.getFileVersionId() == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, "CONTRACT_PDF_REQUIRED", "Contract PDF is required before assigning signer.");
        }

        ProjectMemberEntity signerMember = projectMemberRepository.findByProjectIdAndUserIdAndDeletedAtIsNull(contract.getProjectId(), request.signerUserId())
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "SIGNER_NOT_FOUND", "Signer is not a project member."));
        if (signerMember.getRole() != MemberRole.CLIENT_OWNER && signerMember.getRole() != MemberRole.CLIENT_MEMBER) {
            throw new AppException(HttpStatus.BAD_REQUEST, "SIGNER_ROLE_INVALID", "Signer must be a client member.");
        }

        UserEntity signer = userRepository.findByIdAndDeletedAtIsNull(request.signerUserId())
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "SIGNER_USER_NOT_FOUND", "Signer user not found."));

        EnvelopeEntity envelope = findLatestEnvelope(contract.getId(), principal.getTenantId())
                .orElseGet(() -> createDefaultEnvelope(contract, principal.getUserId(), principal.getTenantId()));
        if (envelope.getStatus() == EnvelopeStatus.COMPLETED || envelope.getStatus() == EnvelopeStatus.VOIDED) {
            envelope.setStatus(EnvelopeStatus.DRAFT);
            envelope.setCompletedAt(null);
        }
        if (envelope.getStatus() == EnvelopeStatus.SENT || envelope.getStatus() == EnvelopeStatus.PARTIALLY_SIGNED) {
            throw new AppException(
                    HttpStatus.BAD_REQUEST,
                    "ENVELOPE_REASSIGNMENT_NOT_ALLOWED",
                    "Cannot reassign signer after envelope has been sent."
            );
        }

        softDeleteRecipients(envelope.getId(), principal.getTenantId(), principal.getUserId());
        softDeleteFields(envelope.getId(), principal.getTenantId(), principal.getUserId());

        SignatureRecipientEntity recipient = new SignatureRecipientEntity();
        recipient.setTenantId(principal.getTenantId());
        recipient.setEnvelopeId(envelope.getId());
        recipient.setRecipientEmail(signer.getEmail());
        recipient.setRecipientName(signer.getName());
        recipient.setRecipientToken(UUID.randomUUID().toString().replace("-", ""));
        recipient.setSigningOrder(1);
        recipient.setStatus(RecipientStatus.PENDING);
        recipient.setCreatedBy(principal.getUserId());
        recipient.setUpdatedBy(principal.getUserId());
        SignatureRecipientEntity savedRecipient = recipientRepository.save(recipient);

        int signaturePage = resolvePage(request.signaturePage(), 1, "signaturePage");
        double signatureCoordX = resolveNormalizedCoord(request.signatureCoordX(), 0.67, "signatureCoordX");
        double signatureCoordY = resolveNormalizedCoord(request.signatureCoordY(), 0.84, "signatureCoordY");
        double signatureCoordW = resolveNormalizedSize(request.signatureCoordW(), 0.27, "signatureCoordW");
        double signatureCoordH = resolveNormalizedSize(request.signatureCoordH(), 0.08, "signatureCoordH");

        SignatureFieldEntity signatureField = createField(
                principal.getTenantId(),
                envelope.getId(),
                savedRecipient.getId(),
                SignatureFieldType.SIGNATURE,
                signaturePage,
                signatureCoordX,
                signatureCoordY,
                signatureCoordW,
                signatureCoordH,
                principal.getUserId()
        );
        SignatureFieldEntity savedSignatureField = fieldRepository.save(signatureField);

        boolean includeDateField = request.includeDateField() == null || request.includeDateField();
        SignatureFieldEntity savedDateField = null;
        if (includeDateField) {
            int datePage = resolvePage(request.datePage(), signaturePage, "datePage");
            double dateCoordX = resolveNormalizedCoord(request.dateCoordX(), signatureCoordX, "dateCoordX");
            double dateCoordY = resolveNormalizedCoord(request.dateCoordY(), Math.max(0d, signatureCoordY - 0.08d), "dateCoordY");
            double dateCoordW = resolveNormalizedSize(request.dateCoordW(), signatureCoordW, "dateCoordW");
            double dateCoordH = resolveNormalizedSize(request.dateCoordH(), 0.04, "dateCoordH");

            SignatureFieldEntity dateField = createField(
                    principal.getTenantId(),
                    envelope.getId(),
                    savedRecipient.getId(),
                    SignatureFieldType.DATE,
                    datePage,
                    dateCoordX,
                    dateCoordY,
                    dateCoordW,
                    dateCoordH,
                    principal.getUserId()
            );
            savedDateField = fieldRepository.save(dateField);
        }

        envelope.setStatus(EnvelopeStatus.SENT);
        envelope.setSentAt(OffsetDateTime.now());
        envelope.setCompletedAt(null);
        envelope.setUpdatedBy(principal.getUserId());
        EnvelopeEntity savedEnvelope = envelopeRepository.save(envelope);

        contract.setStatus(ContractStatus.DRAFT);
        contract.setUpdatedBy(principal.getUserId());
        contractRepository.save(contract);

        createEvent(savedEnvelope, savedRecipient.getId(), SignatureEventType.SENT, Map.of(
                "envelopeId", savedEnvelope.getId(),
                "recipientId", savedRecipient.getId(),
                "signerUserId", signer.getId()
        ));
        outboxService.publish(principal.getTenantId(), principal.getUserId(), "envelope", savedEnvelope.getId(),
                "signature.sent", "Signature sent", signer.getEmail(),
                Map.of("envelopeId", savedEnvelope.getId(), "recipientId", savedRecipient.getId()));

        Map<String, Object> response = new HashMap<>();
        response.put("assigned", true);
        response.put("envelopeId", savedEnvelope.getId());
        response.put("recipientId", savedRecipient.getId());
        response.put("recipientName", savedRecipient.getRecipientName());
        response.put("recipientEmail", savedRecipient.getRecipientEmail());
        response.put("recipientStatus", savedRecipient.getStatus());
        response.put("envelopeStatus", savedEnvelope.getStatus());
        response.put("signatureField", toFieldPayload(savedSignatureField));
        if (savedDateField != null) {
            response.put("dateField", toFieldPayload(savedDateField));
        }
        return ApiSuccess.of(response);
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

    private Optional<EnvelopeEntity> findLatestEnvelope(UUID contractId, UUID tenantId) {
        return envelopeRepository.findByContractIdAndTenantIdAndDeletedAtIsNull(contractId, tenantId).stream()
                .max(Comparator.comparing(EnvelopeEntity::getCreatedAt));
    }

    private Optional<SignatureRecipientEntity> findLatestRecipient(UUID envelopeId, UUID tenantId) {
        return recipientRepository.findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(envelopeId, tenantId).stream()
                .max(Comparator.comparing(SignatureRecipientEntity::getCreatedAt));
    }

    private EnvelopeEntity createDefaultEnvelope(ContractEntity contract, UUID actorUserId, UUID tenantId) {
        EnvelopeEntity envelope = new EnvelopeEntity();
        envelope.setTenantId(tenantId);
        envelope.setContractId(contract.getId());
        envelope.setTitle(contract.getName() + " Signature");
        envelope.setStatus(EnvelopeStatus.DRAFT);
        envelope.setCreatedBy(actorUserId);
        envelope.setUpdatedBy(actorUserId);
        return envelopeRepository.save(envelope);
    }

    private void softDeleteRecipients(UUID envelopeId, UUID tenantId, UUID actorUserId) {
        OffsetDateTime now = OffsetDateTime.now();
        List<SignatureRecipientEntity> recipients = recipientRepository.findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(envelopeId, tenantId);
        recipients.forEach(item -> {
            item.setDeletedAt(now);
            item.setUpdatedBy(actorUserId);
        });
        if (!recipients.isEmpty()) {
            recipientRepository.saveAll(recipients);
        }
    }

    private void softDeleteFields(UUID envelopeId, UUID tenantId, UUID actorUserId) {
        OffsetDateTime now = OffsetDateTime.now();
        List<SignatureFieldEntity> fields = fieldRepository.findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(envelopeId, tenantId);
        fields.forEach(item -> {
            item.setDeletedAt(now);
            item.setUpdatedBy(actorUserId);
        });
        if (!fields.isEmpty()) {
            fieldRepository.saveAll(fields);
        }
    }

    private SignatureFieldEntity createField(UUID tenantId,
                                             UUID envelopeId,
                                             UUID recipientId,
                                             SignatureFieldType type,
                                             int page,
                                             double coordX,
                                             double coordY,
                                             double coordW,
                                             double coordH,
                                             UUID actorUserId) {
        SignatureFieldEntity field = new SignatureFieldEntity();
        field.setTenantId(tenantId);
        field.setEnvelopeId(envelopeId);
        field.setRecipientId(recipientId);
        field.setType(type);
        field.setPage(page);
        field.setCoordX(coordX);
        field.setCoordY(coordY);
        field.setCoordW(coordW);
        field.setCoordH(coordH);
        field.setCreatedBy(actorUserId);
        field.setUpdatedBy(actorUserId);
        return field;
    }

    private int resolvePage(Integer value, int fallback, String fieldName) {
        int resolved = value == null ? fallback : value;
        if (resolved < 1) {
            throw new AppException(HttpStatus.BAD_REQUEST, "SIGN_FIELD_PAGE_INVALID", fieldName + " must be greater than or equal to 1.");
        }
        return resolved;
    }

    private double resolveNormalizedCoord(Double value, double fallback, String fieldName) {
        double resolved = value == null ? fallback : value;
        if (resolved < 0d || resolved > 1d) {
            throw new AppException(HttpStatus.BAD_REQUEST, "SIGN_FIELD_COORD_INVALID", fieldName + " must be between 0 and 1.");
        }
        return resolved;
    }

    private double resolveNormalizedSize(Double value, double fallback, String fieldName) {
        double resolved = value == null ? fallback : value;
        if (resolved <= 0d || resolved > 1d) {
            throw new AppException(HttpStatus.BAD_REQUEST, "SIGN_FIELD_SIZE_INVALID", fieldName + " must be greater than 0 and less than or equal to 1.");
        }
        return resolved;
    }

    private Map<String, Object> toFieldPayload(SignatureFieldEntity field) {
        return Map.of(
                "id", field.getId(),
                "type", field.getType(),
                "page", field.getPage(),
                "coordX", field.getCoordX(),
                "coordY", field.getCoordY(),
                "coordW", field.getCoordW(),
                "coordH", field.getCoordH()
        );
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
                                  SignatureFieldType type,
                                  int page, double coordX, double coordY, double coordW, double coordH) {
    }

    public record AssignSignerRequest(UUID signerUserId,
                                      Integer signaturePage,
                                      Double signatureCoordX,
                                      Double signatureCoordY,
                                      Double signatureCoordW,
                                      Double signatureCoordH,
                                      Boolean includeDateField,
                                      Integer datePage,
                                      Double dateCoordX,
                                      Double dateCoordY,
                                      Double dateCoordW,
                                      Double dateCoordH) {
    }

    public record ReviewContractRequest(Boolean approved) {
    }
}
