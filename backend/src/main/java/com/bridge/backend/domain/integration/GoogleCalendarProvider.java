package com.bridge.backend.domain.integration;

import java.util.Map;

public interface GoogleCalendarProvider {
    Map<String, Object> createMeeting(Map<String, Object> payload);
}
