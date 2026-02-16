package com.bridge.backend.domain.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class DisabledEmailNotificationSender implements EmailNotificationSender {
    private static final Logger log = LoggerFactory.getLogger(DisabledEmailNotificationSender.class);

    @Override
    public void send(String to, String subject, String body) {
        log.info("FEATURE_DISABLED email sender to={}, subject={}", to, subject);
    }
}
