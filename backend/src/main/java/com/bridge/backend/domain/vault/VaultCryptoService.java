package com.bridge.backend.domain.vault;

import com.bridge.backend.common.api.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

@Service
public class VaultCryptoService {
    private final byte[] key;
    private final SecureRandom secureRandom = new SecureRandom();

    public VaultCryptoService(@Value("${bridge.vault.master-key}") String rawKey) {
        byte[] bytes = rawKey.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "VAULT_KEY_INVALID", "VAULT_MASTER_KEY는 최소 32바이트여야 합니다.");
        }
        this.key = new byte[32];
        System.arraycopy(bytes, 0, key, 0, 32);
    }

    public EncryptedSecret encrypt(String plainText) {
        try {
            byte[] nonce = new byte[12];
            secureRandom.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, nonce));
            byte[] ciphertext = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
            return new EncryptedSecret(
                    Base64.getEncoder().encodeToString(ciphertext),
                    Base64.getEncoder().encodeToString(nonce),
                    1
            );
        } catch (Exception ex) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "VAULT_ENCRYPT_ERROR", "Vault 암호화에 실패했습니다.");
        }
    }

    public String decrypt(String ciphertext, String nonce) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"),
                    new GCMParameterSpec(128, Base64.getDecoder().decode(nonce)));
            byte[] plain = cipher.doFinal(Base64.getDecoder().decode(ciphertext));
            return new String(plain, StandardCharsets.UTF_8);
        } catch (Exception ex) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "VAULT_DECRYPT_ERROR", "Vault 복호화에 실패했습니다.");
        }
    }

    public record EncryptedSecret(String ciphertext, String nonce, int version) {
    }
}
