package com.bridge.backend.domain.signing;

import com.bridge.backend.common.api.ApiSuccess;
import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.ContractStatus;
import com.bridge.backend.common.model.enums.EnvelopeStatus;
import com.bridge.backend.common.model.enums.MemberRole;
import com.bridge.backend.common.model.enums.RecipientStatus;
import com.bridge.backend.common.model.enums.SignatureEventType;
import com.bridge.backend.common.model.enums.SignatureFieldType;
import com.bridge.backend.common.security.AuthPrincipal;
import com.bridge.backend.common.security.SecurityUtils;
import com.bridge.backend.common.tenant.AccessGuardService;
import com.bridge.backend.domain.auth.UserEntity;
import com.bridge.backend.domain.contract.ContractEntity;
import com.bridge.backend.domain.contract.ContractRepository;
import com.bridge.backend.domain.contract.EnvelopeEntity;
import com.bridge.backend.domain.contract.EnvelopeRepository;
import com.bridge.backend.domain.contract.SignatureEventEntity;
import com.bridge.backend.domain.contract.SignatureEventRepository;
import com.bridge.backend.domain.contract.SignatureFieldEntity;
import com.bridge.backend.domain.contract.SignatureFieldRepository;
import com.bridge.backend.domain.contract.SignatureRecipientEntity;
import com.bridge.backend.domain.contract.SignatureRecipientRepository;
import com.bridge.backend.domain.file.FileVersionEntity;
import com.bridge.backend.domain.file.FileVersionRepository;
import com.bridge.backend.domain.file.StorageService;
import com.bridge.backend.domain.notification.OutboxService;
import com.bridge.backend.domain.project.ProjectMemberEntity;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
public class SigningController {
    private static final long MAX_SIGNABLE_PDF_BYTES = 20L * 1024L * 1024L;
    private static final int MAX_TEXT_FIELD_LENGTH = 2000;
    private static final int MAX_SIGNATURE_DATA_URL_LENGTH = 2_500_000;
    private static final Set<String> CHECKBOX_VALUES = Set.of("true", "false", "1", "0", "yes", "no", "y", "n", "on", "off");

    private final SignatureRecipientRepository recipientRepository;
    private final SignatureFieldRepository fieldRepository;
    private final SignatureEventRepository eventRepository;
    private final EnvelopeRepository envelopeRepository;
    private final ContractRepository contractRepository;
    private final FileVersionRepository fileVersionRepository;
    private final AccessGuardService guardService;
    private final StorageService storageService;
    private final OutboxService outboxService;
    private final ObjectMapper objectMapper;
    private final PdfSigningService pdfSigningService;

    public SigningController(SignatureRecipientRepository recipientRepository,
                             SignatureFieldRepository fieldRepository,
                             SignatureEventRepository eventRepository,
                             EnvelopeRepository envelopeRepository,
                             ContractRepository contractRepository,
                             FileVersionRepository fileVersionRepository,
                             AccessGuardService guardService,
                             StorageService storageService,
                             OutboxService outboxService,
                             ObjectMapper objectMapper,
                             PdfSigningService pdfSigningService) {
        this.recipientRepository = recipientRepository;
        this.fieldRepository = fieldRepository;
        this.eventRepository = eventRepository;
        this.envelopeRepository = envelopeRepository;
        this.contractRepository = contractRepository;
        this.fileVersionRepository = fileVersionRepository;
        this.guardService = guardService;
        this.storageService = storageService;
        this.outboxService = outboxService;
        this.objectMapper = objectMapper;
        this.pdfSigningService = pdfSigningService;
    }

    @GetMapping("/api/signing/contracts/{contractId}")
    public ApiSuccess<Map<String, Object>> get(@PathVariable UUID contractId) {
        SigningContext context = resolveSigningContext(contractId);
        Map<String, Object> response = new HashMap<>();
        response.put("contractId", context.contract().getId());
        response.put("projectId", context.contract().getProjectId());
        response.put("envelope", context.envelope());
        response.put("recipient", context.recipient());
        response.put("fields", fieldRepository.findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(
                context.envelope().getId(), context.tenantId()).stream()
                .filter(field -> context.recipient().getId().equals(field.getRecipientId()))
                .toList());
        response.put("pdfDownloadUrl", resolveDownloadUrl(context.contract()));
        return ApiSuccess.of(response);
    }

    @PostMapping("/api/signing/contracts/{contractId}/viewed")
    public ApiSuccess<Map<String, Object>> viewed(@PathVariable UUID contractId) {
        SigningContext context = resolveSigningContext(contractId);
        if (context.recipient().getStatus() == RecipientStatus.PENDING) {
            context.recipient().setStatus(RecipientStatus.VIEWED);
            context.recipient().setUpdatedBy(context.actorUserId());
            recipientRepository.save(context.recipient());

            createEvent(context.recipient(), SignatureEventType.VIEWED, Map.of("recipientId", context.recipient().getId()), context.actorUserId());
            outboxService.publish(context.tenantId(), context.actorUserId(), "envelope", context.envelope().getId(),
                    "signature.viewed", "Signature document viewed", context.recipient().getRecipientEmail(),
                    Map.of("recipientId", context.recipient().getId()));
        }
        return ApiSuccess.of(Map.of("viewed", true));
    }

    @PostMapping("/api/signing/contracts/{contractId}/submit")
    @Transactional
    public ApiSuccess<Map<String, Object>> submit(@PathVariable UUID contractId,
                                                   @RequestBody(required = false) SubmitSigningRequest request) {
        SigningContext context = resolveSigningContext(contractId);
        if (context.recipient().getStatus() == RecipientStatus.SIGNED) {
            boolean completed = context.envelope().getStatus() == EnvelopeStatus.COMPLETED;
            return ApiSuccess.of(Map.of(
                    "signed", true,
                    "completed", completed,
                    "alreadySigned", true,
                    "fileVersionId", context.contract().getFileVersionId(),
                    "projectId", context.contract().getProjectId()
            ));
        }

        List<SignatureFieldEntity> recipientFields = fieldRepository.findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(
                        context.envelope().getId(), context.tenantId()).stream()
                .filter(field -> context.recipient().getId().equals(field.getRecipientId()))
                .toList();
        Map<UUID, String> fieldValues = normalizeFieldValues(request);
        validateSubmittedFieldValues(recipientFields, fieldValues, request == null ? null : request.signatureDataUrl());

        FileVersionEntity signedVersion = appendSignatureToContractPdf(context.contract(), context.recipient(), recipientFields, fieldValues, request, context.actorUserId());

        context.recipient().setStatus(RecipientStatus.SIGNED);
        context.recipient().setUpdatedBy(context.actorUserId());
        recipientRepository.save(context.recipient());
        createEvent(context.recipient(), SignatureEventType.SIGNED, Map.of(
                "recipientId", context.recipient().getId(),
                "fileVersionId", signedVersion.getId(),
                "fieldIds", fieldValues.keySet().stream().map(UUID::toString).toList()
        ), context.actorUserId());

        List<SignatureRecipientEntity> recipients = recipientRepository
                .findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(context.envelope().getId(), context.tenantId());
        boolean allSigned = recipients.stream().allMatch(r -> r.getStatus() == RecipientStatus.SIGNED);
        if (allSigned) {
            context.envelope().setStatus(EnvelopeStatus.COMPLETED);
            context.envelope().setCompletedAt(OffsetDateTime.now());
            context.contract().setStatus(ContractStatus.ACTIVE);
            context.contract().setUpdatedBy(context.actorUserId());
            contractRepository.save(context.contract());
        } else {
            context.envelope().setStatus(EnvelopeStatus.PARTIALLY_SIGNED);
        }
        context.envelope().setUpdatedBy(context.actorUserId());
        envelopeRepository.save(context.envelope());

        if (allSigned) {
            createEvent(context.recipient(), SignatureEventType.COMPLETED, Map.of(
                    "envelopeId", context.envelope().getId(),
                    "fileVersionId", signedVersion.getId()
            ), context.actorUserId());
            outboxService.publish(context.tenantId(), context.actorUserId(), "envelope", context.envelope().getId(),
                    "signature.completed", "Signature completed", context.envelope().getTitle(),
                    Map.of("envelopeId", context.envelope().getId(), "fileVersionId", signedVersion.getId()));
            return ApiSuccess.of(Map.of(
                    "signed", true,
                    "completed", true,
                    "alreadySigned", false,
                    "fileVersionId", signedVersion.getId(),
                    "projectId", context.contract().getProjectId()
            ));
        }

        outboxService.publish(context.tenantId(), context.actorUserId(), "envelope", context.envelope().getId(),
                "signature.signed", "Signature processed", context.recipient().getRecipientEmail(),
                Map.of("recipientId", context.recipient().getId(), "fileVersionId", signedVersion.getId()));
        return ApiSuccess.of(Map.of(
                "signed", true,
                "completed", false,
                "alreadySigned", false,
                "fileVersionId", signedVersion.getId(),
                "projectId", context.contract().getProjectId()
        ));
    }

    private SigningContext resolveSigningContext(UUID contractId) {
        AuthPrincipal principal = SecurityUtils.requirePrincipal();
        ContractEntity contract = requireActiveContract(contractId);
        ProjectMemberEntity member = guardService.requireProjectMember(contract.getProjectId(), principal.getUserId(), principal.getTenantId());
        if (member.getRole() != MemberRole.CLIENT_OWNER && member.getRole() != MemberRole.CLIENT_MEMBER) {
            throw new AppException(HttpStatus.FORBIDDEN, "ROLE_FORBIDDEN", "Only client owners or client members can sign.");
        }

        EnvelopeEntity envelope = envelopeRepository.findByContractIdAndTenantIdAndDeletedAtIsNull(contractId, principal.getTenantId())
                .stream()
                .max(Comparator.comparing(EnvelopeEntity::getCreatedAt))
                .orElseThrow(() -> new AppException(HttpStatus.BAD_REQUEST, "SIGNING_NOT_READY", "Signature request is not prepared."));
        if (envelope.getStatus() == EnvelopeStatus.VOIDED) {
            throw new AppException(HttpStatus.GONE, "SIGNING_ENVELOPE_VOIDED", "This envelope is no longer available for signing.");
        }

        UserEntity user = guardService.requireUser(principal.getUserId());
        SignatureRecipientEntity recipient = recipientRepository.findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(envelope.getId(), principal.getTenantId())
                .stream()
                .filter(item -> item.getRecipientEmail().equalsIgnoreCase(user.getEmail()))
                .max(Comparator.comparing(SignatureRecipientEntity::getCreatedAt))
                .orElseThrow(() -> new AppException(HttpStatus.FORBIDDEN, "SIGNING_NOT_ASSIGNED", "You are not assigned as signer."));

        return new SigningContext(contract, envelope, recipient, principal.getTenantId(), principal.getUserId());
    }

    private FileVersionEntity appendSignatureToContractPdf(ContractEntity contract,
                                                           SignatureRecipientEntity recipient,
                                                           List<SignatureFieldEntity> recipientFields,
                                                           Map<UUID, String> fieldValues,
                                                           SubmitSigningRequest request,
                                                           UUID actorUserId) {
        UUID baseFileVersionId = contract.getFileVersionId();
        if (baseFileVersionId == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, "CONTRACT_PDF_NOT_FOUND", "Contract does not have a PDF version.");
        }

        FileVersionEntity baseVersion = requireActiveVersion(baseFileVersionId);
        if (baseVersion.getSize() > MAX_SIGNABLE_PDF_BYTES) {
            throw new AppException(
                    HttpStatus.BAD_REQUEST,
                    "CONTRACT_PDF_TOO_LARGE",
                    "Contract PDF is too large to sign in-app."
            );
        }
        Path sourcePdfPath = null;
        Path signedPdfPath = null;
        try (InputStream sourceStream = storageService.downloadObjectStream(baseVersion.getObjectKey())) {
            sourcePdfPath = Files.createTempFile("signing-source-", ".pdf");
            Files.copy(sourceStream, sourcePdfPath, StandardCopyOption.REPLACE_EXISTING);
            signedPdfPath = pdfSigningService.applyRecipientFields(
                    sourcePdfPath,
                    recipientFields,
                    fieldValues,
                    request == null ? null : request.signatureDataUrl(),
                    recipient.getRecipientName()
            );

            long signedPdfSize = Files.size(signedPdfPath);
            String checksum = sha256Hex(signedPdfPath);
            List<FileVersionEntity> versions = fileVersionRepository.findByFileIdAndTenantIdAndDeletedAtIsNullOrderByVersionDesc(
                    baseVersion.getFileId(),
                    contract.getTenantId()
            );
            int nextVersion = versions.stream()
                    .findFirst()
                    .map(v -> v.getVersion() + 1)
                    .orElse(1);

            StorageService.UploadTarget uploadTarget = storageService.createUploadTarget(
                    baseVersion.getFileId(),
                    nextVersion,
                    "application/pdf",
                    signedPdfSize,
                    checksum
            );
            storageService.uploadToPresignedUrl(uploadTarget.uploadUrl(), uploadTarget.contentType(), signedPdfPath);

            boolean validTicket = storageService.verifyUploadTicket(
                    uploadTarget.uploadTicket(),
                    baseVersion.getFileId(),
                    uploadTarget.version(),
                    uploadTarget.objectKey(),
                    uploadTarget.contentType(),
                    uploadTarget.size(),
                    uploadTarget.checksum()
            );
            if (!validTicket) {
                throw new AppException(HttpStatus.BAD_REQUEST, "UPLOAD_TICKET_INVALID", "Upload ticket is invalid or expired.");
            }

            try {
                versions.stream()
                        .filter(FileVersionEntity::isLatest)
                        .forEach(v -> {
                            v.setLatest(false);
                            fileVersionRepository.save(v);
                        });

                FileVersionEntity signedVersion = new FileVersionEntity();
                signedVersion.setTenantId(contract.getTenantId());
                signedVersion.setFileId(baseVersion.getFileId());
                signedVersion.setVersion(uploadTarget.version());
                signedVersion.setObjectKey(uploadTarget.objectKey());
                signedVersion.setContentType(uploadTarget.contentType());
                signedVersion.setSize(uploadTarget.size());
                signedVersion.setChecksum(uploadTarget.checksum());
                signedVersion.setLatest(true);
                signedVersion.setCreatedBy(actorUserId);
                signedVersion.setUpdatedBy(actorUserId);
                FileVersionEntity savedVersion = fileVersionRepository.save(signedVersion);

                contract.setFileVersionId(savedVersion.getId());
                contract.setUpdatedBy(actorUserId);
                contractRepository.save(contract);
                return savedVersion;
            } catch (RuntimeException ex) {
                storageService.deleteByUploadUrl(uploadTarget.uploadUrl());
                throw ex;
            }
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to prepare signed PDF.", ex);
        } finally {
            deleteTempFileQuietly(signedPdfPath);
            deleteTempFileQuietly(sourcePdfPath);
        }
    }

    private void validateSubmittedFieldValues(List<SignatureFieldEntity> fields,
                                              Map<UUID, String> fieldValues,
                                              String signatureDataUrl) {
        for (SignatureFieldEntity field : fields) {
            String value = fieldValues.get(field.getId());
            SignatureFieldType type = field.getType();
            if (type == SignatureFieldType.CHECKBOX) {
                if (hasValue(value) && !CHECKBOX_VALUES.contains(value.trim().toLowerCase())) {
                    throw new AppException(HttpStatus.BAD_REQUEST, "SIGNING_FIELD_INVALID", "Checkbox field value is invalid.");
                }
                continue;
            }
            if (type == SignatureFieldType.DATE) {
                if (hasValue(value)) {
                    try {
                        LocalDate.parse(value.trim());
                    } catch (Exception ex) {
                        throw new AppException(HttpStatus.BAD_REQUEST, "SIGNING_DATE_INVALID", "Date field must be in yyyy-MM-dd format.");
                    }
                }
                continue;
            }
            if (type == SignatureFieldType.SIGNATURE || type == SignatureFieldType.INITIAL) {
                String dataUrl = hasValue(value) ? value : signatureDataUrl;
                if (!hasValue(dataUrl)) {
                    throw new AppException(HttpStatus.BAD_REQUEST, "SIGNING_FIELD_REQUIRED", "Signature field value is required.");
                }
                validateSignatureDataUrl(dataUrl);
                continue;
            }

            if (!hasValue(value)) {
                throw new AppException(HttpStatus.BAD_REQUEST, "SIGNING_FIELD_REQUIRED", "Field value is required.");
            }
            if (value.length() > MAX_TEXT_FIELD_LENGTH) {
                throw new AppException(HttpStatus.BAD_REQUEST, "SIGNING_FIELD_TOO_LONG", "Field value is too long.");
            }
        }
    }

    private void validateSignatureDataUrl(String signatureDataUrl) {
        String trimmed = signatureDataUrl == null ? "" : signatureDataUrl.trim();
        if (!trimmed.startsWith("data:image/") || !trimmed.contains(";base64,")) {
            throw new AppException(HttpStatus.BAD_REQUEST, "SIGNATURE_FORMAT_INVALID", "Signature must be a valid image data URL.");
        }
        if (trimmed.length() > MAX_SIGNATURE_DATA_URL_LENGTH) {
            throw new AppException(HttpStatus.BAD_REQUEST, "SIGNATURE_TOO_LARGE", "Signature image data is too large.");
        }
    }

    private Map<UUID, String> normalizeFieldValues(SubmitSigningRequest request) {
        if (request == null || request.fieldValues() == null || request.fieldValues().isEmpty()) {
            return Map.of();
        }
        return request.fieldValues().entrySet().stream()
                .filter(entry -> entry.getKey() != null)
                .filter(entry -> entry.getValue() != null)
                .collect(Collectors.toMap(
                        entry -> parseUuid(entry.getKey()),
                        Map.Entry::getValue,
                        (left, right) -> right
                ));
    }

    private UUID parseUuid(String raw) {
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException ex) {
            throw new AppException(HttpStatus.BAD_REQUEST, "SIGNING_FIELD_ID_INVALID", "Invalid signature field id.");
        }
    }

    private boolean hasValue(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String sha256Hex(Path filePath) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            try (InputStream inputStream = Files.newInputStream(filePath)) {
                int read;
                while ((read = inputStream.read(buffer)) != -1) {
                    digest.update(buffer, 0, read);
                }
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to compute PDF checksum.", ex);
        }
    }

    private void deleteTempFileQuietly(Path path) {
        if (path == null) {
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // best effort only
        }
    }

    private ContractEntity requireActiveContract(UUID contractId) {
        ContractEntity contract = contractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND", "Contract not found."));
        if (contract.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND", "Contract not found.");
        }
        return contract;
    }

    private FileVersionEntity requireActiveVersion(UUID fileVersionId) {
        FileVersionEntity version = fileVersionRepository.findById(fileVersionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "FILE_VERSION_NOT_FOUND", "File version not found."));
        if (version.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "FILE_VERSION_NOT_FOUND", "File version not found.");
        }
        return version;
    }

    private String resolveDownloadUrl(ContractEntity contract) {
        UUID fileVersionId = contract.getFileVersionId();
        if (fileVersionId == null) {
            return "";
        }
        FileVersionEntity version = requireActiveVersion(fileVersionId);
        return storageService.createDownloadPresign(version.getObjectKey());
    }

    private void createEvent(SignatureRecipientEntity recipient, SignatureEventType eventType, Object payload, UUID actorUserId) {
        SignatureEventEntity event = new SignatureEventEntity();
        event.setTenantId(recipient.getTenantId());
        event.setEnvelopeId(recipient.getEnvelopeId());
        event.setRecipientId(recipient.getId());
        event.setEventType(eventType);
        event.setEventPayload(serializeEventPayload(payload));
        event.setCreatedBy(actorUserId);
        event.setUpdatedBy(actorUserId);
        eventRepository.save(event);
    }

    private String serializeEventPayload(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            return String.valueOf(payload);
        }
    }

    private record SigningContext(ContractEntity contract,
                                  EnvelopeEntity envelope,
                                  SignatureRecipientEntity recipient,
                                  UUID tenantId,
                                  UUID actorUserId) {
    }

    public record SubmitSigningRequest(Map<String, String> fieldValues, String signatureDataUrl) {
    }
}
