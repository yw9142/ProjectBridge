package com.bridge.backend.domain.notification;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class NotificationStreamService {
    private final Map<EmitterKey, SseEmitter> emitters = new ConcurrentHashMap<>();

    public SseEmitter connect(UUID tenantId, UUID userId, String appScope) {
        EmitterKey key = new EmitterKey(tenantId, userId, appScope);
        SseEmitter emitter = new SseEmitter(0L);
        emitters.put(key, emitter);
        emitter.onCompletion(() -> emitters.remove(key));
        emitter.onTimeout(() -> emitters.remove(key));
        emitter.onError(ignored -> emitters.remove(key));
        sendToScope(tenantId, userId, appScope, "system.ping", Map.of("connected", true));
        return emitter;
    }

    public void send(UUID tenantId, UUID userId, String eventType, Object payload) {
        emitters.keySet().stream()
                .filter(key -> key.tenantId().equals(tenantId) && key.userId().equals(userId))
                .forEach(key -> sendToEmitter(key, eventType, payload));
    }

    public void sendToScope(UUID tenantId, UUID userId, String appScope, String eventType, Object payload) {
        sendToEmitter(new EmitterKey(tenantId, userId, appScope), eventType, payload);
    }

    private void sendToEmitter(EmitterKey key, String eventType, Object payload) {
        SseEmitter emitter = emitters.get(key);
        if (emitter == null) {
            return;
        }
        try {
            emitter.send(SseEmitter.event().name(eventType).data(payload));
        } catch (IOException ex) {
            emitter.completeWithError(ex);
            emitters.remove(key);
        }
    }

    private record EmitterKey(UUID tenantId, UUID userId, String appScope) {
        private EmitterKey {
            Objects.requireNonNull(tenantId, "tenantId");
            Objects.requireNonNull(userId, "userId");
            Objects.requireNonNull(appScope, "appScope");
        }
    }
}
