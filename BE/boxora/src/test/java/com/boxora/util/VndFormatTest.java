package com.boxora.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

class VndFormatTest {

    @Test
    @DisplayName("Tiền Việt: dấu chấm phân cách hàng nghìn, không số lẻ, hậu tố ₫")
    void formatsVietnameseStyle() {
        assertThat(VndFormat.format(new BigDecimal("1250000"))).isEqualTo("1.250.000 ₫");
        assertThat(VndFormat.format(new BigDecimal("450000.00"))).isEqualTo("450.000 ₫");
        assertThat(VndFormat.format(new BigDecimal("1000"))).isEqualTo("1.000 ₫");
        assertThat(VndFormat.format(new BigDecimal("999"))).isEqualTo("999 ₫");
        assertThat(VndFormat.format(BigDecimal.ZERO)).isEqualTo("0 ₫");
        assertThat(VndFormat.format((BigDecimal) null)).isEqualTo("0 ₫");
        assertThat(VndFormat.format(12_345_678L)).isEqualTo("12.345.678 ₫");
        assertThat(VndFormat.format(new BigDecimal("1499.5"))).isEqualTo("1.500 ₫");
    }

    @Test
    @DisplayName("Kết quả không phụ thuộc locale mặc định của máy chủ")
    void ignoresTheDefaultLocale() {
        Locale previous = Locale.getDefault();
        try {
            Locale.setDefault(Locale.US);
            assertThat(VndFormat.format(new BigDecimal("1250000"))).isEqualTo("1.250.000 ₫");
            Locale.setDefault(Locale.GERMANY);
            assertThat(VndFormat.format(new BigDecimal("1250000"))).isEqualTo("1.250.000 ₫");
            Locale.setDefault(Locale.forLanguageTag("ar-EG"));
            assertThat(VndFormat.format(new BigDecimal("1250000"))).isEqualTo("1.250.000 ₫");
        } finally {
            Locale.setDefault(previous);
        }
    }

    @Test
    @DisplayName("Số giấy tờ được che, chỉ giữ 4 ký tự cuối")
    void masksIdentityNumbers() {
        assertThat(IdentityDocuments.mask("001092003891")).isEqualTo("********3891");
        assertThat(IdentityDocuments.mask("B1234567")).isEqualTo("****4567");
        assertThat(IdentityDocuments.mask("123")).isEqualTo("***");
        assertThat(IdentityDocuments.mask(null)).isEmpty();
        assertThat(IdentityDocuments.mask("  ")).isEmpty();
    }
}
