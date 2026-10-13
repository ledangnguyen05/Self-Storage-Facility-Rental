package com.boxora.service;

import com.boxora.service.impl.EncryptionServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EncryptionServiceTest {

    private EncryptionService encryptionService;

    @BeforeEach
    void setUp() {
        encryptionService = new EncryptionServiceImpl("TestSecretKeyForAes256GcmTesting123456!");
    }

    @Test
    @DisplayName("Should successfully encrypt and decrypt 6-digit PIN")
    void testEncryptAndDecrypt() {
        String pin = "123456";
        String encrypted = encryptionService.encrypt(pin);

        assertThat(encrypted).isNotNull();
        assertThat(encrypted).isNotEqualTo(pin);

        String decrypted = encryptionService.decrypt(encrypted);
        assertThat(decrypted).isEqualTo(pin);
    }

    @Test
    @DisplayName("Different encryptions of same PIN should yield different ciphertexts due to random IV")
    void testRandomIvProducesDifferentCiphertext() {
        String pin = "889900";
        String enc1 = encryptionService.encrypt(pin);
        String enc2 = encryptionService.encrypt(pin);

        assertThat(enc1).isNotEqualTo(enc2);
        assertThat(encryptionService.decrypt(enc1)).isEqualTo(pin);
        assertThat(encryptionService.decrypt(enc2)).isEqualTo(pin);
    }

    @Test
    @DisplayName("Decrypt should gracefully return legacy plain text PIN")
    void testLegacyPlainTextPinFallback() {
        String legacyPin = "882914";
        String result = encryptionService.decrypt(legacyPin);

        assertThat(result).isEqualTo(legacyPin);
    }
}
