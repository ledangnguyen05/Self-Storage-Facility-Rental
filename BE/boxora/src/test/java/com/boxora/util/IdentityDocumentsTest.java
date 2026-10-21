package com.boxora.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class IdentityDocumentsTest {

    @Test
    @DisplayName("CCCD is 9 or 12 digits; a 10 digit phone number is not an ID")
    void cccd() {
        assertThat(IdentityDocuments.isValidNumber("CCCD", "079090123456")).isTrue();
        assertThat(IdentityDocuments.isValidNumber("CCCD", "123456789")).isTrue();
        assertThat(IdentityDocuments.isValidNumber(null, "0912345678")).isFalse();
        assertThat(IdentityDocuments.isValidNumber("CCCD", "B1234567")).isFalse();
    }

    @Test
    @DisplayName("passport accepts letters + digits, 6-12 characters, at least one digit")
    void passport() {
        assertThat(IdentityDocuments.isValidNumber("PASSPORT", "B1234567")).isTrue();
        assertThat(IdentityDocuments.isValidNumber("passport", "c9876543")).isTrue();
        assertThat(IdentityDocuments.isValidNumber("PASSPORT", "ABCDEFGH")).isFalse();
        assertThat(IdentityDocuments.isValidNumber("PASSPORT", "B12")).isFalse();
        assertThat(IdentityDocuments.normalizeNumber("PASSPORT", " b1234567 ")).isEqualTo("B1234567");
        assertThat(IdentityDocuments.isSupportedType("DRIVER")).isFalse();
    }
}
