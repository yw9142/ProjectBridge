package com.bridge.backend.domain.signing;

import com.bridge.backend.common.api.ApiSuccess;
import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.EnvelopeStatus;
import com.bridge.backend.common.model.enums.RecipientStatus;
import com.bridge.backend.common.model.enums.SignatureEventType;
import com.bridge.backend.domain.auth.UserRepository;
import com.bridge.backend.domain.contract.ContractEntity;
import com.bridge.backend.domain.contract.ContractRepository;
import com.bridge.backend.domain.contract.EnvelopeEntity;
import com.bridge.backend.domain.contract.EnvelopeRepository;
import com.bridge.backend.domain.contract.SignatureEventEntity;
import com.bridge.backend.domain.contract.SignatureEventRepository;
import com.bridge.backend.domain.contract.SignatureFieldRepository;
import com.bridge.backend.domain.contract.SignatureRecipientEntity;
import com.bridge.backend.domain.contract.SignatureRecipientRepository;
import com.bridge.backend.domain.file.FileVersionEntity;
import com.bridge.backend.domain.file.FileVersionRepository;
import com.bridge.backend.domain.file.StorageService;
import com.bridge.backend.domain.notification.OutboxService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
public class SigningController {
    private final SignatureRecipientRepository recipientRepository;
    private final SignatureFieldRepository fieldRepository;
    private final SignatureEventRepository eventRepository;
    private final EnvelopeRepository envelopeRepository;
    private final ContractRepository contractRepository;
    private final FileVersionRepository fileVersionRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;
    private final OutboxService outboxService;

    public SigningController(SignatureRecipientRepository recipientRepository,
                             SignatureFieldRepository fieldRepository,
                             SignatureEventRepository eventRepository,
                             EnvelopeRepository envelopeRepository,
                             ContractRepository contractRepository,
                             FileVersionRepository fileVersionRepository,
                             UserRepository userRepository,
                             StorageService storageService,
                             OutboxService outboxService) {
        this.recipientRepository = recipientRepository;
        this.fieldRepository = fieldRepository;
        this.eventRepository = eventRepository;
        this.envelopeRepository = envelopeRepository;
        this.contractRepository = contractRepository;
        this.fileVersionRepository = fileVersionRepository;
        this.userRepository = userRepository;
        this.storageService = storageService;
        this.outboxService = outboxService;
    }

    @GetMapping("/api/signing/{recipientToken}")
    public ApiSuccess<Map<String, Object>> get(@PathVariable String recipientToken) {
        SignatureRecipientEntity recipient = requireRecipientByToken(recipientToken);
        EnvelopeEntity envelope = requireActiveEnvelope(recipient.getEnvelopeId());
        ContractEntity contract = requireActiveContract(envelope.getContractId());

        Map<String, Object> response = new HashMap<>();
        response.put("envelope", envelope);
        response.put("recipient", recipient);
        response.put("fields", fieldRepository.findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(envelope.getId(), envelope.getTenantId()));
        response.put("pdfDownloadUrl", resolveDownloadUrl(contract));
        return ApiSuccess.of(response);
    }

    @PostMapping("/api/signing/{recipientToken}/viewed")
    public ApiSuccess<Map<String, Object>> viewed(@PathVariable String recipientToken) {
        SignatureRecipientEntity recipient = requireRecipientByToken(recipientToken);
        EnvelopeEntity envelope = requireActiveEnvelope(recipient.getEnvelopeId());
        UUID actorUserId = resolveOutboxActorUserId(recipient, envelope);

        recipient.setStatus(RecipientStatus.VIEWED);
        recipient.setUpdatedBy(actorUserId);
        recipientRepository.save(recipient);

        createEvent(recipient, SignatureEventType.VIEWED, Map.of("recipientId", recipient.getId()), actorUserId);
        outboxService.publish(recipient.getTenantId(), actorUserId, "envelope", recipient.getEnvelopeId(),
                "signature.viewed", "Signature document viewed", recipient.getRecipientEmail(), Map.of("recipientId", recipient.getId()));
        return ApiSuccess.of(Map.of("viewed", true));
    }

    @PostMapping("/api/signing/{recipientToken}/submit")
    public ApiSuccess<Map<String, Object>> submit(@PathVariable String recipientToken) {
        SignatureRecipientEntity recipient = requireRecipientByToken(recipientToken);
        EnvelopeEntity envelope = requireActiveEnvelope(recipient.getEnvelopeId());
        UUID actorUserId = resolveOutboxActorUserId(recipient, envelope);

        recipient.setStatus(RecipientStatus.SIGNED);
        recipient.setUpdatedBy(actorUserId);
        recipientRepository.save(recipient);
        createEvent(recipient, SignatureEventType.SIGNED, Map.of("recipientId", recipient.getId()), actorUserId);

        List<SignatureRecipientEntity> recipients = recipientRepository
                .findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(envelope.getId(), envelope.getTenantId());
        boolean allSigned = recipients.stream().allMatch(r -> r.getStatus() == RecipientStatus.SIGNED);
        if (allSigned) {
            envelope.setStatus(EnvelopeStatus.COMPLETED);
            envelope.setCompletedAt(OffsetDateTime.now());
            envelope.setUpdatedBy(actorUserId);
            envelopeRepository.save(envelope);

            createEvent(recipient, SignatureEventType.COMPLETED, Map.of("envelopeId", envelope.getId()), actorUserId);
            outboxService.publish(recipient.getTenantId(), actorUserId, "envelope", envelope.getId(),
                    "signature.completed", "Signature completed", envelope.getTitle(), Map.of("envelopeId", envelope.getId()));
            return ApiSuccess.of(Map.of("signed", true, "completed", true));
        }

        outboxService.publish(recipient.getTenantId(), actorUserId, "envelope", envelope.getId(),
                "signature.signed", "Signature processed", recipient.getRecipientEmail(), Map.of("recipientId", recipient.getId()));
        return ApiSuccess.of(Map.of("signed", true, "completed", false));
    }

    private SignatureRecipientEntity requireRecipientByToken(String recipientToken) {
        SignatureRecipientEntity recipient = recipientRepository.findByRecipientTokenAndDeletedAtIsNull(recipientToken)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "SIGNING_TOKEN_NOT_FOUND", "Signing token not found."));
        EnvelopeEntity envelope = requireActiveEnvelope(recipient.getEnvelopeId());
        if (envelope.getStatus() == EnvelopeStatus.VOIDED) {
            throw new AppException(HttpStatus.GONE, "SIGNING_ENVELOPE_VOIDED", "This envelope is no longer available for signing.");
        }
        return recipient;
    }

    private EnvelopeEntity requireActiveEnvelope(UUID envelopeId) {
        EnvelopeEntity envelope = envelopeRepository.findById(envelopeId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "ENVELOPE_NOT_FOUND", "Envelope not found."));
        if (envelope.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "ENVELOPE_NOT_FOUND", "Envelope not found.");
        }
        return envelope;
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

    private UUID resolveOutboxActorUserId(SignatureRecipientEntity recipient, EnvelopeEntity envelope) {
        Optional<UUID> matchedUser = userRepository.findByEmailAndDeletedAtIsNull(recipient.getRecipientEmail().toLowerCase())
                .map(user -> user.getId());
        if (matchedUser.isPresent()) {
            return matchedUser.get();
        }
        if (envelope.getCreatedBy() != null) {
            return envelope.getCreatedBy();
        }
        if (recipient.getCreatedBy() != null) {
            return recipient.getCreatedBy();
        }
        return UUID.nameUUIDFromBytes(("recipient:" + recipient.getId()).getBytes());
    }

    private void createEvent(SignatureRecipientEntity recipient, SignatureEventType eventType, Object payload, UUID actorUserId) {
        SignatureEventEntity event = new SignatureEventEntity();
        event.setTenantId(recipient.getTenantId());
        event.setEnvelopeId(recipient.getEnvelopeId());
        event.setRecipientId(recipient.getId());
        event.setEventType(eventType);
        event.setEventPayload(String.valueOf(payload));
        event.setCreatedBy(actorUserId);
        event.setUpdatedBy(actorUserId);
        eventRepository.save(event);
    }
}
