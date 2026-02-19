package com.bridge.backend.domain.signing;

import com.bridge.backend.common.api.ApiSuccess;
import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.EnvelopeStatus;
import com.bridge.backend.common.model.enums.RecipientStatus;
import com.bridge.backend.common.model.enums.SignatureEventType;
import com.bridge.backend.domain.contract.*;
import com.bridge.backend.domain.notification.OutboxService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
public class SigningController {
    private final SignatureRecipientRepository recipientRepository;
    private final SignatureFieldRepository fieldRepository;
    private final SignatureEventRepository eventRepository;
    private final EnvelopeRepository envelopeRepository;
    private final OutboxService outboxService;

    public SigningController(SignatureRecipientRepository recipientRepository,
                             SignatureFieldRepository fieldRepository,
                             SignatureEventRepository eventRepository,
                             EnvelopeRepository envelopeRepository,
                             OutboxService outboxService) {
        this.recipientRepository = recipientRepository;
        this.fieldRepository = fieldRepository;
        this.eventRepository = eventRepository;
        this.envelopeRepository = envelopeRepository;
        this.outboxService = outboxService;
    }

    @GetMapping("/api/signing/{recipientToken}")
    public ApiSuccess<Map<String, Object>> get(@PathVariable String recipientToken) {
        SignatureRecipientEntity recipient = requireActiveRecipient(recipientToken);
        EnvelopeEntity envelope = requireActiveEnvelope(recipient.getEnvelopeId());
        return ApiSuccess.of(Map.of(
                "envelope", envelope,
                "recipient", recipient,
                "fields", fieldRepository.findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(envelope.getId(), envelope.getTenantId()),
                "pdfDownloadUrl", "/api/envelopes/" + envelope.getId()
        ));
    }

    @PostMapping("/api/signing/{recipientToken}/viewed")
    public ApiSuccess<Map<String, Object>> viewed(@PathVariable String recipientToken) {
        SignatureRecipientEntity recipient = requireActiveRecipient(recipientToken);
        EnvelopeEntity envelope = requireActiveEnvelope(recipient.getEnvelopeId());

        if (recipient.getStatus() == RecipientStatus.PENDING) {
            recipient.setStatus(RecipientStatus.VIEWED);
            recipient.setUpdatedBy(resolveEventActorUserId(envelope, recipient));
            recipientRepository.save(recipient);
            createEvent(envelope, recipient, SignatureEventType.VIEWED, Map.of("recipientId", recipient.getId()));
        }

        UUID actorUserId = resolveEventActorUserId(envelope, recipient);
        outboxService.publish(recipient.getTenantId(), actorUserId, "envelope", recipient.getEnvelopeId(),
                "signature.viewed", "Signature document viewed", recipient.getRecipientEmail(), Map.of("recipientId", recipient.getId()));
        return ApiSuccess.of(Map.of("viewed", true));
    }

    @PostMapping("/api/signing/{recipientToken}/submit")
    public ApiSuccess<Map<String, Object>> submit(@PathVariable String recipientToken) {
        SignatureRecipientEntity recipient = requireActiveRecipient(recipientToken);
        EnvelopeEntity envelope = requireActiveEnvelope(recipient.getEnvelopeId());

        if (recipient.getStatus() != RecipientStatus.SIGNED) {
            recipient.setStatus(RecipientStatus.SIGNED);
            recipient.setUpdatedBy(resolveEventActorUserId(envelope, recipient));
            recipientRepository.save(recipient);
            createEvent(envelope, recipient, SignatureEventType.SIGNED, Map.of("recipientId", recipient.getId()));
        }

        List<SignatureRecipientEntity> recipients = recipientRepository
                .findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(envelope.getId(), envelope.getTenantId());
        boolean allSigned = recipients.stream().allMatch(r -> r.getStatus() == RecipientStatus.SIGNED);
        UUID actorUserId = resolveEventActorUserId(envelope, recipient);
        if (allSigned) {
            envelope.setStatus(EnvelopeStatus.COMPLETED);
            envelope.setCompletedAt(OffsetDateTime.now());
            envelope.setUpdatedBy(actorUserId);
            envelopeRepository.save(envelope);
            createEvent(envelope, recipient, SignatureEventType.COMPLETED, Map.of("envelopeId", envelope.getId()));
            outboxService.publish(recipient.getTenantId(), actorUserId, "envelope", envelope.getId(),
                    "signature.completed", "Electronic signature completed", envelope.getTitle(), Map.of("envelopeId", envelope.getId()));
            return ApiSuccess.of(Map.of("signed", true, "completed", true, "completedPdfUrl", "/api/envelopes/" + envelope.getId()));
        }
        outboxService.publish(recipient.getTenantId(), actorUserId, "envelope", envelope.getId(),
                "signature.signed", "Electronic signature submitted", recipient.getRecipientEmail(), Map.of("recipientId", recipient.getId()));
        return ApiSuccess.of(Map.of("signed", true, "completed", false));
    }

    private SignatureRecipientEntity requireActiveRecipient(String recipientToken) {
        SignatureRecipientEntity recipient = recipientRepository.findByRecipientTokenAndDeletedAtIsNull(recipientToken)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "SIGNING_TOKEN_NOT_FOUND", "Signing token not found."));
        return recipient;
    }

    private EnvelopeEntity requireActiveEnvelope(UUID envelopeId) {
        EnvelopeEntity envelope = envelopeRepository.findById(envelopeId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "ENVELOPE_NOT_FOUND", "Envelope not found."));
        if (envelope.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "ENVELOPE_NOT_FOUND", "Envelope not found.");
        }
        if (envelope.getStatus() == EnvelopeStatus.VOIDED) {
            throw new AppException(HttpStatus.BAD_REQUEST, "ENVELOPE_VOIDED", "This envelope is voided.");
        }
        return envelope;
    }

    private void createEvent(EnvelopeEntity envelope, SignatureRecipientEntity recipient, SignatureEventType eventType, Object payload) {
        SignatureEventEntity event = new SignatureEventEntity();
        event.setTenantId(envelope.getTenantId());
        event.setEnvelopeId(envelope.getId());
        event.setRecipientId(recipient.getId());
        event.setEventType(eventType);
        event.setEventPayload(String.valueOf(payload));
        UUID actorUserId = resolveEventActorUserId(envelope, recipient);
        event.setCreatedBy(actorUserId);
        event.setUpdatedBy(actorUserId);
        eventRepository.save(event);
    }

    private UUID resolveEventActorUserId(EnvelopeEntity envelope, SignatureRecipientEntity recipient) {
        if (envelope.getCreatedBy() != null) {
            return envelope.getCreatedBy();
        }
        if (recipient.getUpdatedBy() != null) {
            return recipient.getUpdatedBy();
        }
        return recipient.getCreatedBy();
    }
}
