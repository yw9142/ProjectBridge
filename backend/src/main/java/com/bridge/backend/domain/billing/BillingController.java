package com.bridge.backend.domain.billing;

import com.bridge.backend.common.api.ApiSuccess;
import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.InvoiceAttachmentType;
import com.bridge.backend.common.model.enums.InvoicePhase;
import com.bridge.backend.common.model.enums.InvoiceStatus;
import com.bridge.backend.common.model.enums.MemberRole;
import com.bridge.backend.common.security.SecurityUtils;
import com.bridge.backend.common.tenant.AccessGuardService;
import com.bridge.backend.domain.file.StorageService;
import com.bridge.backend.domain.file.UploadTicketEntity;
import com.bridge.backend.domain.file.UploadTicketRepository;
import com.bridge.backend.domain.notification.OutboxService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@RestController
public class BillingController {
    private final InvoiceRepository invoiceRepository;
    private final InvoiceAttachmentRepository attachmentRepository;
    private final UploadTicketRepository uploadTicketRepository;
    private final AccessGuardService guardService;
    private final StorageService storageService;
    private final OutboxService outboxService;

    public BillingController(InvoiceRepository invoiceRepository,
                             InvoiceAttachmentRepository attachmentRepository,
                             UploadTicketRepository uploadTicketRepository,
                             AccessGuardService guardService,
                             StorageService storageService,
                             OutboxService outboxService) {
        this.invoiceRepository = invoiceRepository;
        this.attachmentRepository = attachmentRepository;
        this.uploadTicketRepository = uploadTicketRepository;
        this.guardService = guardService;
        this.storageService = storageService;
        this.outboxService = outboxService;
    }

    @GetMapping("/api/projects/{projectId}/invoices")
    public ApiSuccess<List<InvoiceEntity>> list(@PathVariable UUID projectId) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMember(projectId, principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(invoiceRepository.findByProjectIdAndTenantIdAndDeletedAtIsNull(projectId, principal.getTenantId()));
    }

    @PostMapping("/api/projects/{projectId}/invoices")
    public ApiSuccess<InvoiceEntity> create(@PathVariable UUID projectId, @RequestBody @Valid CreateInvoiceRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setTenantId(principal.getTenantId());
        invoice.setProjectId(projectId);
        String invoiceNumber = request.invoiceNumber();
        if (invoiceNumber == null || invoiceNumber.isBlank()) {
            invoiceNumber = generateInvoiceNumber(projectId, request.phase());
        }
        invoice.setInvoiceNumber(invoiceNumber);
        invoice.setPhase(Objects.requireNonNullElse(request.phase(), InvoicePhase.FINAL));
        invoice.setAmount(request.amount());
        invoice.setCurrency(request.currency() == null ? "KRW" : request.currency());
        invoice.setDueAt(request.dueAt());
        invoice.setCreatedBy(principal.getUserId());
        invoice.setUpdatedBy(principal.getUserId());
        return ApiSuccess.of(invoiceRepository.save(invoice));
    }

    @PatchMapping("/api/invoices/{invoiceId}")
    public ApiSuccess<InvoiceEntity> patchInvoice(@PathVariable UUID invoiceId, @RequestBody PatchInvoiceRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        InvoiceEntity invoice = requireActiveInvoice(invoiceId);
        guardService.requireProjectMemberRole(invoice.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        if (request.invoiceNumber() != null) {
            invoice.setInvoiceNumber(request.invoiceNumber());
        }
        if (request.amount() != null) {
            invoice.setAmount(request.amount());
        }
        if (request.currency() != null) {
            invoice.setCurrency(request.currency());
        }
        if (request.dueAt() != null) {
            invoice.setDueAt(request.dueAt());
        }
        if (request.status() != null) {
            invoice.setStatus(request.status());
        }
        if (request.phase() != null) {
            invoice.setPhase(request.phase());
        }
        invoice.setUpdatedBy(principal.getUserId());
        return ApiSuccess.of(invoiceRepository.save(invoice));
    }

    @DeleteMapping("/api/invoices/{invoiceId}")
    public ApiSuccess<Map<String, Object>> deleteInvoice(@PathVariable UUID invoiceId) {
        var principal = SecurityUtils.requirePrincipal();
        InvoiceEntity invoice = requireActiveInvoice(invoiceId);
        guardService.requireProjectMemberRole(invoice.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        invoice.setDeletedAt(OffsetDateTime.now());
        invoice.setUpdatedBy(principal.getUserId());
        invoiceRepository.save(invoice);
        return ApiSuccess.of(Map.of("deleted", true));
    }

    @PatchMapping("/api/invoices/{invoiceId}/status")
    public ApiSuccess<InvoiceEntity> patchStatus(@PathVariable UUID invoiceId, @RequestBody UpdateStatusRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        InvoiceEntity invoice = requireActiveInvoice(invoiceId);
        guardService.requireProjectMember(invoice.getProjectId(), principal.getUserId(), principal.getTenantId());
        invoice.setStatus(request.status());
        invoice.setUpdatedBy(principal.getUserId());
        InvoiceEntity saved = invoiceRepository.save(invoice);
        outboxService.publish(principal.getTenantId(), principal.getUserId(), "invoice", saved.getId(),
                "invoice.status.changed", "Invoice status changed", saved.getStatus().name(), Map.of("invoiceId", saved.getId()));
        return ApiSuccess.of(saved);
    }

    @GetMapping("/api/invoices/{invoiceId}/attachments")
    public ApiSuccess<List<InvoiceAttachmentEntity>> attachments(@PathVariable UUID invoiceId) {
        var principal = SecurityUtils.requirePrincipal();
        InvoiceEntity invoice = requireActiveInvoice(invoiceId);
        guardService.requireProjectMember(invoice.getProjectId(), principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(attachmentRepository.findByInvoiceIdAndTenantIdAndDeletedAtIsNull(invoiceId, principal.getTenantId()));
    }

    @PostMapping("/api/invoices/{invoiceId}/attachments/presign")
    public ApiSuccess<Map<String, Object>> presignAttachment(@PathVariable UUID invoiceId, @RequestBody @Valid PresignAttachmentRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        InvoiceEntity invoice = requireActiveInvoice(invoiceId);
        guardService.requireProjectMember(invoice.getProjectId(), principal.getUserId(), principal.getTenantId());
        Map<String, Object> presigned = storageService.createUploadPresign(invoiceId, 1, request.contentType());
        UploadTicketEntity ticket = new UploadTicketEntity();
        ticket.setTenantId(principal.getTenantId());
        ticket.setAggregateType("invoice_attachment");
        ticket.setAggregateId(invoiceId);
        ticket.setObjectKey(String.valueOf(presigned.get("objectKey")));
        ticket.setContentType(request.contentType());
        ticket.setExpiresAt(OffsetDateTime.now().plusMinutes(15));
        ticket.setCreatedBy(principal.getUserId());
        ticket.setUpdatedBy(principal.getUserId());
        UploadTicketEntity savedTicket = uploadTicketRepository.save(ticket);

        Map<String, Object> response = new HashMap<>(presigned);
        response.put("uploadToken", savedTicket.getId());
        return ApiSuccess.of(response);
    }

    @PostMapping("/api/invoices/{invoiceId}/attachments/complete")
    public ApiSuccess<InvoiceAttachmentEntity> completeAttachment(@PathVariable UUID invoiceId, @RequestBody @Valid CompleteAttachmentRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        InvoiceEntity invoice = requireActiveInvoice(invoiceId);
        guardService.requireProjectMember(invoice.getProjectId(), principal.getUserId(), principal.getTenantId());
        UploadTicketEntity ticket = requireUsableUploadTicket(request.uploadToken(), principal.getTenantId(), "invoice_attachment", invoiceId);
        if (!ticket.getObjectKey().equals(request.objectKey())) {
            throw new AppException(HttpStatus.BAD_REQUEST, "UPLOAD_OBJECT_KEY_MISMATCH", "Upload ticket object key mismatch.");
        }

        InvoiceAttachmentEntity entity = new InvoiceAttachmentEntity();
        entity.setTenantId(principal.getTenantId());
        entity.setInvoiceId(invoiceId);
        entity.setAttachmentType(request.attachmentType());
        entity.setObjectKey(request.objectKey());
        entity.setCreatedBy(principal.getUserId());
        entity.setUpdatedBy(principal.getUserId());
        InvoiceAttachmentEntity saved = attachmentRepository.save(entity);
        ticket.setConsumedAt(OffsetDateTime.now());
        ticket.setUpdatedBy(principal.getUserId());
        uploadTicketRepository.save(ticket);
        return ApiSuccess.of(saved);
    }

    private InvoiceEntity requireActiveInvoice(UUID invoiceId) {
        InvoiceEntity invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "INVOICE_NOT_FOUND", "인보이스를 찾을 수 없습니다."));
        if (invoice.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "INVOICE_NOT_FOUND", "인보이스를 찾을 수 없습니다.");
        }
        return invoice;
    }

    private String generateInvoiceNumber(UUID projectId, InvoicePhase phase) {
        String prefix = phase == null ? "FINAL" : phase.name();
        return "INV-" + prefix + "-" + projectId.toString().substring(0, 8) + "-" + System.currentTimeMillis();
    }

    private UploadTicketEntity requireUsableUploadTicket(UUID uploadToken, UUID tenantId, String aggregateType, UUID aggregateId) {
        UploadTicketEntity ticket = uploadTicketRepository.findByIdAndTenantIdAndDeletedAtIsNull(uploadToken, tenantId)
                .orElseThrow(() -> new AppException(HttpStatus.BAD_REQUEST, "UPLOAD_TOKEN_NOT_FOUND", "Upload token is invalid."));
        if (!aggregateType.equals(ticket.getAggregateType()) || !aggregateId.equals(ticket.getAggregateId())) {
            throw new AppException(HttpStatus.BAD_REQUEST, "UPLOAD_TOKEN_SCOPE_MISMATCH", "Upload token scope mismatch.");
        }
        if (ticket.getConsumedAt() != null) {
            throw new AppException(HttpStatus.BAD_REQUEST, "UPLOAD_TOKEN_CONSUMED", "Upload token already consumed.");
        }
        if (ticket.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new AppException(HttpStatus.BAD_REQUEST, "UPLOAD_TOKEN_EXPIRED", "Upload token expired.");
        }
        return ticket;
    }

    public record CreateInvoiceRequest(String invoiceNumber, long amount, String currency, OffsetDateTime dueAt, InvoicePhase phase) {
    }

    public record PatchInvoiceRequest(String invoiceNumber, Long amount, String currency, OffsetDateTime dueAt, InvoiceStatus status, InvoicePhase phase) {
    }

    public record UpdateStatusRequest(InvoiceStatus status) {
    }

    public record PresignAttachmentRequest(@NotBlank String contentType) {
    }

    public record CompleteAttachmentRequest(InvoiceAttachmentType attachmentType, @NotBlank String objectKey, @NotNull UUID uploadToken) {
    }
}
