package com.boxora.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;
import java.util.SortedMap;

import static org.assertj.core.api.Assertions.assertThat;

class VNPayUtilTest {

    @Test
    @DisplayName("sortParams should sort keys alphabetically and ignore null or empty values")
    void testSortParams() {
        Map<String, String> input = new HashMap<>();
        input.put("vnp_Version", "2.1.0");
        input.put("vnp_Amount", "10000000");
        input.put("vnp_Command", "pay");
        input.put("vnp_Empty", "");
        input.put("vnp_Null", null);

        SortedMap<String, String> sorted = VNPayUtil.sortParams(input);

        assertThat(sorted).containsOnlyKeys("vnp_Amount", "vnp_Command", "vnp_Version");
        assertThat(sorted.firstKey()).isEqualTo("vnp_Amount");
        assertThat(sorted.lastKey()).isEqualTo("vnp_Version");
    }

    @Test
    @DisplayName("buildHashData should encode parameter values with US_ASCII")
    void testBuildHashData() {
        Map<String, String> input = new HashMap<>();
        input.put("vnp_OrderInfo", "Thanh toan don hang");
        input.put("vnp_Amount", "100000");

        SortedMap<String, String> sorted = VNPayUtil.sortParams(input);
        String hashData = VNPayUtil.buildHashData(sorted);

        assertThat(hashData).isEqualTo("vnp_Amount=100000&vnp_OrderInfo=Thanh+toan+don+hang");
    }

    @Test
    @DisplayName("hmacSHA512 should produce consistent 128-char hex string")
    void testHmacSHA512() {
        String secret = "TEST_SECRET_KEY_123456";
        String data = "vnp_Amount=100000&vnp_Command=pay";

        String hash1 = VNPayUtil.hmacSHA512(secret, data);
        String hash2 = VNPayUtil.hmacSHA512(secret, data);

        assertThat(hash1).isNotEmpty();
        assertThat(hash1).hasSize(128); // 64 bytes in hex = 128 hex chars
        assertThat(hash1).isEqualTo(hash2);
    }

    @Test
    @DisplayName("normalizeIp should handle IPv6 localhost and comma-separated proxy headers")
    void testNormalizeIp() {
        assertThat(VNPayUtil.normalizeIp(null)).isEqualTo("127.0.0.1");
        assertThat(VNPayUtil.normalizeIp("")).isEqualTo("127.0.0.1");
        assertThat(VNPayUtil.normalizeIp("0:0:0:0:0:0:0:1")).isEqualTo("127.0.0.1");
        assertThat(VNPayUtil.normalizeIp("::1")).isEqualTo("127.0.0.1");
        assertThat(VNPayUtil.normalizeIp("192.168.1.100, 10.0.0.1")).isEqualTo("192.168.1.100");
        assertThat(VNPayUtil.normalizeIp("14.241.12.34")).isEqualTo("14.241.12.34");
    }
}
