package com.bridge.backend.domain.file;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

@Service
public class StorageService {
    private static final String HMAC_ALGO = "HmacSHA256";
    private static final long DEFAULT_UPLOAD_TICKET_TTL_SECONDS = 900L;
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(20);
    private static final int MAX_RETRY_ATTEMPTS = 2;
    private static final long RETRY_BACKOFF_MILLIS = 250L;

    private final String endpoint;
    private final String bucket;
    private final byte[] presignSecret;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(CONNECT_TIMEOUT)
            .build();

    public StorageService(@Value("${bridge.storage.endpoint}") String endpoint,
                          @Value("${bridge.storage.bucket}") String bucket,
                          @Value("${bridge.storage.presign-secret}") String presignSecret,
                          ObjectMapper objectMapper) {
        this.endpoint = endpoint;
        this.bucket = bucket;
        this.presignSecret = presignSecret.getBytes(StandardCharsets.UTF_8);
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> createUploadPresign(UUID fileId,
                                                   int nextVersion,
                                                   String contentType,
                                                   long size,
                                                   String checksum) {
        UploadTarget target = createUploadTarget(fileId, nextVersion, contentType, size, checksum);
        return Map.of(
                "uploadUrl", target.uploadUrl(),
                "objectKey", target.objectKey(),
                "version", target.version(),
                "expiresAt", target.expiresAt(),
                "contentType", target.contentType(),
                "size", target.size(),
                "checksum", target.checksum(),
                "uploadTicket", target.uploadTicket()
        );
    }

    public UploadTarget createUploadTarget(UUID fileId,
                                           int nextVersion,
                                           String contentType,
                                           long size,
                                           String checksum) {
        String objectKey = "files/" + fileId + "/v" + nextVersion + "/" + UUID.randomUUID();
        Instant expiresAt = Instant.now().plusSeconds(DEFAULT_UPLOAD_TICKET_TTL_SECONDS);
        String uploadTicket = createUploadTicket(new UploadTicketPayload(
                fileId.toString(),
                nextVersion,
                objectKey,
                contentType,
                size,
                checksum,
                expiresAt.getEpochSecond()
        ));
        String uploadUrl = endpoint + "/" + bucket + "/" + objectKey + "?x-presigned-upload=true";
        return new UploadTarget(uploadUrl, objectKey, nextVersion, expiresAt, contentType, size, checksum, uploadTicket);
    }

    public boolean verifyUploadTicket(String ticket,
                                      UUID fileId,
                                      int version,
                                      String objectKey,
                                      String contentType,
                                      long size,
                                      String checksum) {
        try {
            UploadTicketPayload payload = parseUploadTicket(ticket);
            if (payload.expiresAtEpoch() < Instant.now().getEpochSecond()) {
                return false;
            }
            return payload.fileId().equals(fileId.toString())
                    && payload.version() == version
                    && payload.objectKey().equals(objectKey)
                    && payload.contentType().equals(contentType)
                    && payload.size() == size
                    && payload.checksum().equals(checksum);
        } catch (Exception ex) {
            return false;
        }
    }

    public String createDownloadPresign(String objectKey) {
        return endpoint + "/" + bucket + "/" + objectKey + "?x-presigned-download=true";
    }

    public byte[] downloadObject(String objectKey) {
        String downloadUrl = createDownloadPresign(objectKey);
        for (int attempt = 0; ; attempt++) {
            HttpRequest request = HttpRequest.newBuilder(URI.create(downloadUrl))
                    .GET()
                    .timeout(REQUEST_TIMEOUT)
                    .build();
            try {
                HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
                if (response.statusCode() >= 200 && response.statusCode() < 300) {
                    return response.body();
                }
                if (shouldRetry(attempt, response.statusCode())) {
                    sleepBeforeRetry(attempt);
                    continue;
                }
                throw new IllegalStateException("Storage download failed with status " + response.statusCode());
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Storage download failed", ex);
            } catch (IOException ex) {
                if (attempt < MAX_RETRY_ATTEMPTS) {
                    sleepBeforeRetry(attempt);
                    continue;
                }
                throw new IllegalStateException("Storage download failed", ex);
            }
        }
    }

    public InputStream downloadObjectStream(String objectKey) {
        String downloadUrl = createDownloadPresign(objectKey);
        HttpRequest request = HttpRequest.newBuilder(URI.create(downloadUrl))
                .GET()
                .timeout(REQUEST_TIMEOUT)
                .build();
        try {
            HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                try (InputStream ignored = response.body()) {
                    // Close stream from non-success response.
                }
                throw new IllegalStateException("Storage download failed with status " + response.statusCode());
            }
            return response.body();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Storage download failed", ex);
        } catch (IOException ex) {
            throw new IllegalStateException("Storage download failed", ex);
        }
    }

    public void uploadToPresignedUrl(String uploadUrl, String contentType, byte[] bytes) {
        for (int attempt = 0; ; attempt++) {
            HttpRequest request = HttpRequest.newBuilder(URI.create(uploadUrl))
                    .header("Content-Type", contentType)
                    .timeout(REQUEST_TIMEOUT)
                    .PUT(HttpRequest.BodyPublishers.ofByteArray(bytes))
                    .build();
            try {
                HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
                if (response.statusCode() >= 200 && response.statusCode() < 300) {
                    return;
                }
                if (shouldRetry(attempt, response.statusCode())) {
                    sleepBeforeRetry(attempt);
                    continue;
                }
                throw new IllegalStateException("Storage upload failed with status " + response.statusCode());
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Storage upload failed", ex);
            } catch (IOException ex) {
                if (attempt < MAX_RETRY_ATTEMPTS) {
                    sleepBeforeRetry(attempt);
                    continue;
                }
                throw new IllegalStateException("Storage upload failed", ex);
            }
        }
    }

    public void uploadToPresignedUrl(String uploadUrl, String contentType, Path filePath) {
        for (int attempt = 0; ; attempt++) {
            HttpRequest request;
            try {
                request = HttpRequest.newBuilder(URI.create(uploadUrl))
                        .header("Content-Type", contentType)
                        .timeout(REQUEST_TIMEOUT)
                        .PUT(HttpRequest.BodyPublishers.ofFile(filePath))
                        .build();
            } catch (IOException ex) {
                throw new IllegalStateException("Storage upload failed", ex);
            }
            try {
                HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
                if (response.statusCode() >= 200 && response.statusCode() < 300) {
                    return;
                }
                if (shouldRetry(attempt, response.statusCode())) {
                    sleepBeforeRetry(attempt);
                    continue;
                }
                throw new IllegalStateException("Storage upload failed with status " + response.statusCode());
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Storage upload failed", ex);
            } catch (IOException ex) {
                if (attempt < MAX_RETRY_ATTEMPTS) {
                    sleepBeforeRetry(attempt);
                    continue;
                }
                throw new IllegalStateException("Storage upload failed", ex);
            }
        }
    }

    public void deleteByUploadUrl(String uploadUrl) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(uploadUrl))
                .timeout(REQUEST_TIMEOUT)
                .DELETE()
                .build();
        try {
            httpClient.send(request, HttpResponse.BodyHandlers.discarding());
        } catch (Exception ignored) {
            // Best-effort cleanup only.
        }
    }

    private boolean shouldRetry(int attempt, int statusCode) {
        return attempt < MAX_RETRY_ATTEMPTS && (statusCode == 408 || statusCode == 429 || statusCode >= 500);
    }

    private void sleepBeforeRetry(int attempt) {
        long delay = RETRY_BACKOFF_MILLIS * (attempt + 1);
        try {
            Thread.sleep(delay);
        } catch (InterruptedException interruptedException) {
            Thread.currentThread().interrupt();
        }
    }

    private String createUploadTicket(UploadTicketPayload payload) {
        try {
            String payloadJson = objectMapper.writeValueAsString(payload);
            String encodedPayload = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));
            String signature = sign(encodedPayload);
            return encodedPayload + "." + signature;
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private UploadTicketPayload parseUploadTicket(String ticket) throws Exception {
        String[] parts = ticket.split("\\.", 2);
        if (parts.length != 2) {
            throw new IllegalArgumentException("Invalid ticket format");
        }
        String encodedPayload = parts[0];
        String providedSignature = parts[1];
        String expectedSignature = sign(encodedPayload);
        if (!MessageDigest.isEqual(
                providedSignature.getBytes(StandardCharsets.UTF_8),
                expectedSignature.getBytes(StandardCharsets.UTF_8)
        )) {
            throw new IllegalArgumentException("Invalid ticket signature");
        }

        byte[] payloadBytes = Base64.getUrlDecoder().decode(encodedPayload);
        return objectMapper.readValue(payloadBytes, UploadTicketPayload.class);
    }

    private String sign(String encodedPayload) throws Exception {
        Mac mac = Mac.getInstance(HMAC_ALGO);
        mac.init(new SecretKeySpec(presignSecret, HMAC_ALGO));
        byte[] digest = mac.doFinal(encodedPayload.getBytes(StandardCharsets.UTF_8));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    }

    private record UploadTicketPayload(String fileId,
                                       int version,
                                       String objectKey,
                                       String contentType,
                                       long size,
                                       String checksum,
                                       long expiresAtEpoch) {
    }

    public record UploadTarget(String uploadUrl,
                               String objectKey,
                               int version,
                               Instant expiresAt,
                               String contentType,
                               long size,
                               String checksum,
                               String uploadTicket) {
    }
}
