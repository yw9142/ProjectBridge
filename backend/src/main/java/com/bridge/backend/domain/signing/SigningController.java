package com.bridge.backend.domain.signing;

import com.bridge.backend.common.api.ApiSuccess;
import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.EnvelopeStatus;
import com.bridge.backend.common.model.enums.RecipientStatus;
import com.bridge.backend.common.model.enums.SignatureEventType;
import com.bridge.backend.common.security.SecurityUtils;
import com.bridge.backend.domain.auth.UserEntity;
import com.bridge.backend.domain.auth.UserRepository;
import com.bridge.backend.domain.contract.*;
import com.bridge.backend.domain.notification.OutboxService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@RestController
public class SigningController {
    private final SignatureRecipientRepository recipientRepository;
    private final SignatureFieldRepository fieldRepository;
    private final SignatureEventRepository eventRepository;
    private final EnvelopeRepository envelopeRepository;
    private final UserRepository userRepository;
    private final OutboxService outboxService;

    public SigningController(SignatureRecipientRepository recipientRepository,
                             SignatureFieldRepository fieldRepository,
                             SignatureEventRepository eventRepository,
                             EnvelopeRepository envelopeRepository,
                             UserRepository userRepository,
                             OutboxService outboxService) {
        this.recipientRepository = recipientRepository;
        this.fieldRepository = fieldRepository;
        this.eventRepository = eventRepository;
        this.envelopeRepository = envelopeRepository;
        this.userRepository = userRepository;
        this.outboxService = outboxService;
    }

    @GetMapping("/api/signing/{recipientToken}")
    public ApiSuccess<Map<String, Object>> get(@PathVariable String recipientToken) {
        var principal = SecurityUtils.requirePrincipal();
        SignatureRecipientEntity recipient = requireOwnedRecipient(recipientToken, principal.getUserId());
        EnvelopeEntity envelope = envelopeRepository.findById(recipient.getEnvelopeId()).orElseThrow();
        return ApiSuccess.of(Map.of(
                "envelope", envelope,
                "recipient", recipient,
                "fields", fieldRepository.findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(envelope.getId(), envelope.getTenantId()),
                "pdfDownloadUrl", "/api/envelopes/" + envelope.getId()
        ));
    }

    @PostMapping("/api/signing/{recipientToken}/viewed")
    public ApiSuccess<Map<String, Object>> viewed(@PathVariable String recipientToken) {
        var principal = SecurityUtils.requirePrincipal();
        SignatureRecipientEntity recipient = requireOwnedRecipient(recipientToken, principal.getUserId());
        recipient.setStatus(RecipientStatus.VIEWED);
        recipient.setUpdatedBy(principal.getUserId());
        recipientRepository.save(recipient);
        createEvent(recipient, SignatureEventType.VIEWED, Map.of("recipientId", recipient.getId()));
        outboxService.publish(recipient.getTenantId(), principal.getUserId(), "envelope", recipient.getEnvelopeId(),
                "signature.viewed", "서명 문서 열람", recipient.getRecipientEmail(), Map.of("recipientId", recipient.getId()));
        return ApiSuccess.of(Map.of("viewed", true));
    }

    @PostMapping("/api/signing/{recipientToken}/submit")
    public ApiSuccess<Map<String, Object>> submit(@PathVariable String recipientToken) {
        var principal = SecurityUtils.requirePrincipal();
        SignatureRecipientEntity recipient = requireOwnedRecipient(recipientToken, principal.getUserId());
        recipient.setStatus(RecipientStatus.SIGNED);
        recipient.setUpdatedBy(principal.getUserId());
        recipientRepository.save(recipient);
        createEvent(recipient, SignatureEventType.SIGNED, Map.of("recipientId", recipient.getId()));

        EnvelopeEntity envelope = envelopeRepository.findById(recipient.getEnvelopeId()).orElseThrow();
        List<SignatureRecipientEntity> recipients = recipientRepository
                .findByEnvelopeIdAndTenantIdAndDeletedAtIsNull(envelope.getId(), envelope.getTenantId());
        boolean allSigned = recipients.stream().allMatch(r -> r.getStatus() == RecipientStatus.SIGNED);
        if (allSigned) {
            envelope.setStatus(EnvelopeStatus.COMPLETED);
            envelope.setCompletedAt(OffsetDateTime.now());
            envelope.setUpdatedBy(principal.getUserId());
            envelopeRepository.save(envelope);
            createEvent(recipient, SignatureEventType.COMPLETED, Map.of("envelopeId", envelope.getId()));
            outboxService.publish(recipient.getTenantId(), principal.getUserId(), "envelope", envelope.getId(),
                    "signature.completed", "전자서명 완료", envelope.getTitle(), Map.of("envelopeId", envelope.getId()));
            return ApiSuccess.of(Map.of("signed", true, "completed", true, "completedPdfUrl", "/api/envelopes/" + envelope.getId()));
        }
        outboxService.publish(recipient.getTenantId(), principal.getUserId(), "envelope", envelope.getId(),
                "signature.signed", "전자서명 처리", recipient.getRecipientEmail(), Map.of("recipientId", recipient.getId()));
        return ApiSuccess.of(Map.of("signed", true, "completed", false));
    }

    private SignatureRecipientEntity requireOwnedRecipient(String recipientToken, java.util.UUID userId) {
        SignatureRecipientEntity recipient = recipientRepository.findByRecipientTokenAndDeletedAtIsNull(recipientToken)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "SIGNING_TOKEN_NOT_FOUND", "서명 토큰을 찾을 수 없습니다."));
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다."));
        if (!recipient.getRecipientEmail().equalsIgnoreCase(user.getEmail())) {
            throw new AppException(HttpStatus.FORBIDDEN, "SIGNING_TOKEN_FORBIDDEN", "토큰 소유자가 아닙니다.");
        }
        return recipient;
    }

    private void createEvent(SignatureRecipientEntity recipient, SignatureEventType eventType, Object payload) {
        SignatureEventEntity event = new SignatureEventEntity();
        event.setTenantId(recipient.getTenantId());
        event.setEnvelopeId(recipient.getEnvelopeId());
        event.setRecipientId(recipient.getId());
        event.setEventType(eventType);
        event.setEventPayload(String.valueOf(payload));
        event.setCreatedBy(SecurityUtils.currentUserId());
        event.setUpdatedBy(SecurityUtils.currentUserId());
        eventRepository.save(event);
    }
}
