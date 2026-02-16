package com.bridge.backend.domain.file;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class StorageService {
    private final String endpoint;
    private final String bucket;

    public StorageService(@Value("${bridge.storage.endpoint}") String endpoint,
                          @Value("${bridge.storage.bucket}") String bucket) {
        this.endpoint = endpoint;
        this.bucket = bucket;
    }

    public Map<String, Object> createUploadPresign(UUID fileId, int nextVersion, String contentType) {
        String objectKey = "files/" + fileId + "/v" + nextVersion + "/" + UUID.randomUUID();
        String url = endpoint + "/" + bucket + "/" + objectKey + "?x-presigned-upload=true";
        return Map.of(
                "uploadUrl", url,
                "objectKey", objectKey,
                "expiresAt", Instant.now().plusSeconds(900),
                "contentType", contentType
        );
    }

    public String createDownloadPresign(String objectKey) {
        return endpoint + "/" + bucket + "/" + objectKey + "?x-presigned-download=true";
    }
}
