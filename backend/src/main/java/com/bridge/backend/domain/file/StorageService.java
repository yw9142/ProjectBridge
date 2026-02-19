package com.bridge.backend.domain.file;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

@Service
public class StorageService {
    private static final String HMAC_ALGO = "HmacSHA256";
    private static final long DEFAULT_UPLOAD_TICKET_TTL_SECONDS = 900L;

    private final String endpoint;
    private final String bucket;
    private final byte[] presignSecret;
    private final ObjectMapper objectMapper;

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

        String url = endpoint + "/" + bucket + "/" + objectKey + "?x-presigned-upload=true";
        return Map.of(
                "uploadUrl", url,
                "objectKey", objectKey,
                "version", nextVersion,
                "expiresAt", expiresAt,
                "contentType", contentType,
                "size", size,
                "checksum", checksum,
                "uploadTicket", uploadTicket
        );
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
}
