package com.boxora.service.impl;

import com.boxora.service.EncryptionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

@Service
@Slf4j
public class EncryptionServiceImpl implements EncryptionService {

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH_BYTES = 12;
    private static final int GCM_TAG_LENGTH_BITS = 128;

    private final SecretKey secretKey;
    private final SecureRandom secureRandom = new SecureRandom();

    public EncryptionServiceImpl(
            @Value("${app.security.aes-key:BoxoraSecurePinAes256SecretKey2026!}") String rawSecretKey
    ) {
        this.secretKey = deriveAesKey(rawSecretKey);
    }

    private SecretKey deriveAesKey(String rawKey) {
        try {
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            byte[] keyBytes = sha256.digest(rawKey.getBytes(StandardCharsets.UTF_8));
            return new SecretKeySpec(keyBytes, "AES");
        } catch (Exception e) {
            log.error("Failed to derive AES-256 secret key: {}", e.getMessage());
            throw new IllegalStateException("Could not initialize AES-256 encryption", e);
        }
    }

    @Override
    public String encrypt(String plainText) {
        if (plainText == null || plainText.isEmpty()) {
            return plainText;
        }

        try {
            byte[] iv = new byte[GCM_IV_LENGTH_BYTES];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, parameterSpec);

            byte[] cipherTextBytes = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

            // Pack: [IV (12 bytes)] + [Ciphertext + Tag]
            ByteBuffer byteBuffer = ByteBuffer.allocate(iv.length + cipherTextBytes.length);
            byteBuffer.put(iv);
            byteBuffer.put(cipherTextBytes);

            return Base64.getEncoder().encodeToString(byteBuffer.array());
        } catch (Exception e) {
            log.error("AES-256-GCM encryption error: {}", e.getMessage());
            throw new RuntimeException("Error encrypting access PIN", e);
        }
    }

    @Override
    public String decrypt(String cipherText) {
        if (cipherText == null || cipherText.isEmpty()) {
            return cipherText;
        }

        // Graceful handling for legacy unencrypted PINs (e.g., pure numeric or short strings)
        if (cipherText.matches("^\\d{4,8}$")) {
            return cipherText;
        }

        try {
            byte[] decoded = Base64.getDecoder().decode(cipherText);
            if (decoded.length <= GCM_IV_LENGTH_BYTES) {
                return cipherText;
            }

            ByteBuffer byteBuffer = ByteBuffer.wrap(decoded);
            byte[] iv = new byte[GCM_IV_LENGTH_BYTES];
            byteBuffer.get(iv);

            byte[] cipherBytes = new byte[byteBuffer.remaining()];
            byteBuffer.get(cipherBytes);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, parameterSpec);

            byte[] plainTextBytes = cipher.doFinal(cipherBytes);
            return new String(plainTextBytes, StandardCharsets.UTF_8);
        } catch (Exception e) {
            // If it wasn't a valid AES-GCM ciphertext, return original string (e.g. legacy plain text)
            log.debug("String could not be decrypted with AES-256-GCM, returning as-is: {}", e.getMessage());
            return cipherText;
        }
    }
}
