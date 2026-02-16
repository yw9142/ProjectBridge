package com.bridge.backend.domain.notification;

public interface EmailNotificationSender {
    void send(String to, String subject, String body);
}
