package com.bridge.backend.domain.file;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class StorageServiceTest {

    private final StorageService storageService = new StorageService(
            "http://localhost:9000",
            "bridge",
            "test-presign-secret",
            new ObjectMapper()
    );

    @Test
    void uploadTicketIsValidForExactClaims() {
        UUID fileId = UUID.randomUUID();
        int version = 3;
        String contentType = "application/pdf";
        long size = 1024L;
        String checksum = "sha256:abc123";

        Map<String, Object> presign = storageService.createUploadPresign(fileId, version, contentType, size, checksum);

        boolean verified = storageService.verifyUploadTicket(
                String.valueOf(presign.get("uploadTicket")),
                fileId,
                version,
                String.valueOf(presign.get("objectKey")),
                contentType,
                size,
                checksum
        );

        assertThat(verified).isTrue();
    }

    @Test
    void uploadTicketValidationFailsWhenClaimsMismatch() {
        UUID fileId = UUID.randomUUID();
        int version = 1;
        String contentType = "application/pdf";
        long size = 2048L;
        String checksum = "sha256:origin";

        Map<String, Object> presign = storageService.createUploadPresign(fileId, version, contentType, size, checksum);

        boolean verified = storageService.verifyUploadTicket(
                String.valueOf(presign.get("uploadTicket")),
                fileId,
                version,
                String.valueOf(presign.get("objectKey")),
                contentType,
                size,
                "sha256:tampered"
        );

        assertThat(verified).isFalse();
    }
}
