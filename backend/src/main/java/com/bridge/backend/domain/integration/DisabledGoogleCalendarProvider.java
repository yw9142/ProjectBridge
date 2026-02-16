package com.bridge.backend.domain.integration;

import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class DisabledGoogleCalendarProvider implements GoogleCalendarProvider {
    @Override
    public Map<String, Object> createMeeting(Map<String, Object> payload) {
        return Map.of("code", "FEATURE_DISABLED", "message", "Google Calendar integration is disabled");
    }
}
