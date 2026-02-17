package com.bridge.backend.domain.notification;

import java.util.Map;

public final class NotificationTextLocalizer {
    private static final Map<String, String> EVENT_TYPE_LABELS = Map.ofEntries(
            Map.entry("request.created", "요청 생성"),
            Map.entry("request.status.changed", "요청 상태 변경"),
            Map.entry("post.created", "게시글 생성"),
            Map.entry("post.comment.created", "게시글 댓글 생성"),
            Map.entry("meeting.created", "회의 생성"),
            Map.entry("meeting.responded", "회의 응답"),
            Map.entry("invoice.status.changed", "정산 상태 변경"),
            Map.entry("contract.reviewed", "계약 검토"),
            Map.entry("decision.created", "결정 생성"),
            Map.entry("decision.status.changed", "결정 상태 변경"),
            Map.entry("file.version.created", "파일 버전 업로드"),
            Map.entry("file.comment.created", "파일 댓글 생성"),
            Map.entry("file.comment.resolved", "파일 댓글 해결"),
            Map.entry("vault.account.requested", "Vault 계정 요청"),
            Map.entry("vault.account.provisioned", "Vault 계정 제공"),
            Map.entry("vault.access.requested", "Vault 접근 요청"),
            Map.entry("vault.access.reviewed", "Vault 접근 검토"),
            Map.entry("vault.secret.revealed", "Vault 시크릿 열람"),
            Map.entry("signature.sent", "전자서명 요청 발송"),
            Map.entry("signature.viewed", "전자서명 문서 열람"),
            Map.entry("signature.signed", "전자서명 처리"),
            Map.entry("signature.completed", "전자서명 완료")
    );

    private static final Map<String, String> TITLE_LABELS = Map.ofEntries(
            Map.entry("request.created", "요청 생성"),
            Map.entry("request.status.changed", "요청 상태 변경"),
            Map.entry("post.created", "게시글 생성"),
            Map.entry("post.comment.created", "댓글 생성"),
            Map.entry("meeting.created", "회의 생성"),
            Map.entry("meeting.responded", "회의 응답"),
            Map.entry("invoice.status.changed", "정산 상태 변경"),
            Map.entry("contract.reviewed", "계약 검토"),
            Map.entry("decision.created", "결정 생성"),
            Map.entry("decision.status.changed", "결정 상태 변경"),
            Map.entry("file.version.created", "파일 버전 업로드"),
            Map.entry("file.comment.created", "파일 댓글 생성"),
            Map.entry("file.comment.resolved", "파일 댓글 해결"),
            Map.entry("vault.account.requested", "Vault 계정 요청"),
            Map.entry("vault.account.provisioned", "Vault 계정 제공"),
            Map.entry("vault.access.requested", "Vault 접근 요청"),
            Map.entry("vault.access.reviewed", "Vault 접근 검토"),
            Map.entry("vault.secret.revealed", "Vault 시크릿 열람"),
            Map.entry("signature.sent", "전자서명 요청 발송"),
            Map.entry("signature.viewed", "전자서명 문서 열람"),
            Map.entry("signature.signed", "전자서명 처리"),
            Map.entry("signature.completed", "전자서명 완료")
    );

    private static final Map<String, String> STATUS_LABELS = Map.ofEntries(
            Map.entry("DRAFT", "초안"),
            Map.entry("SENT", "발송"),
            Map.entry("ACKED", "확인"),
            Map.entry("IN_PROGRESS", "진행 중"),
            Map.entry("DONE", "완료"),
            Map.entry("REJECTED", "반려"),
            Map.entry("CANCELLED", "취소"),
            Map.entry("APPROVED", "승인"),
            Map.entry("ISSUED", "발행"),
            Map.entry("CONFIRMED", "확정"),
            Map.entry("CLOSED", "종료"),
            Map.entry("OVERDUE", "연체"),
            Map.entry("SCHEDULED", "예정"),
            Map.entry("ACTIVE", "활성"),
            Map.entry("ARCHIVED", "보관"),
            Map.entry("PARTIALLY_SIGNED", "부분 서명"),
            Map.entry("REVOKED", "철회"),
            Map.entry("PENDING", "대기"),
            Map.entry("VIEWED", "열람"),
            Map.entry("SIGNED", "서명 완료"),
            Map.entry("COMPLETED", "완료"),
            Map.entry("REQUESTED", "요청"),
            Map.entry("PROVISIONED", "제공"),
            Map.entry("ACCEPTED", "수락"),
            Map.entry("DECLINED", "거절"),
            Map.entry("MAYBE", "미정")
    );

    private NotificationTextLocalizer() {
    }

    public static String localizeEventType(String eventType) {
        if (eventType == null) {
            return "";
        }
        return EVENT_TYPE_LABELS.getOrDefault(eventType, eventType);
    }

    public static String localizeTitle(String eventType, String title) {
        String mappedByEventType = TITLE_LABELS.get(eventType);
        if (mappedByEventType != null) {
            return mappedByEventType;
        }
        if (title == null) {
            return "";
        }
        return title;
    }

    public static String localizeMessage(String eventType, String message) {
        if (message == null) {
            return "";
        }
        String trimmed = message.trim();
        if (trimmed.isEmpty()) {
            return message;
        }
        if ("file.comment.resolved".equals(eventType) && "resolved".equalsIgnoreCase(trimmed)) {
            return "해결됨";
        }
        return STATUS_LABELS.getOrDefault(trimmed, message);
    }
}
