package com.boxora.util;

import lombok.extern.slf4j.Slf4j;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;

/**
 * Implements VNPay's required signing scheme:
 * 1. Sort all request params alphabetically by key (excluding vnp_SecureHash/vnp_SecureHashType).
 * 2. Build a "hash data" string as key=value pairs joined with '&', URL-encoding each value.
 * 3. Sign that string with HMAC-SHA512 using the merchant's hash secret; hex-encode the result.
 * The same algorithm is used both to build vnp_SecureHash when creating a payment URL, and to
 * verify vnp_SecureHash on the return/IPN callback.
 */
@Slf4j
public final class VNPayUtil {

    private VNPayUtil() {}

    public static SortedMap<String, String> sortParams(Map<String, String> params) {
        SortedMap<String, String> sorted = new TreeMap<>();
        params.forEach((key, value) -> {
            if (value != null && !value.isEmpty()) {
                sorted.put(key, value);
            }
        });
        return sorted;
    }

    /** Builds the exact string VNPay expects to be signed / verified. */
    public static String buildHashData(SortedMap<String, String> sortedParams) {
        StringBuilder sb = new StringBuilder();
        boolean first = true;
        for (Map.Entry<String, String> entry : sortedParams.entrySet()) {
            if (!first) {
                sb.append('&');
            }
            sb.append(entry.getKey()).append('=')
                    .append(java.net.URLEncoder.encode(entry.getValue(), StandardCharsets.US_ASCII));
            first = false;
        }
        return sb.toString();
    }

    public static String hmacSHA512(String key, String data) {
        try {
            Mac hmac512 = Mac.getInstance("HmacSHA512");
            SecretKeySpec secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA512");
            hmac512.init(secretKey);
            byte[] result = hmac512.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(2 * result.length);
            for (byte b : result) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            log.error("Failed to compute VNPay HMAC-SHA512 signature", e);
            throw new IllegalStateException("Could not compute VNPay signature", e);
        }
    }

    /** VNPay requires the IP address of the customer making the request, IPv4-formatted. */
    public static String normalizeIp(String ip) {
        if (ip == null || ip.isBlank() || "0:0:0:0:0:0:0:1".equals(ip)) {
            return "127.0.0.1";
        }
        return ip;
    }

    public static String randomAlphaNumeric(int length) {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }
}