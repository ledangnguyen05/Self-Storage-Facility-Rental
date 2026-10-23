package com.boxora.service.impl;

import com.boxora.config.VNPayConfig;
import com.boxora.service.VNPayService;
import com.boxora.util.VNPayUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.SortedMap;

@Service
@Slf4j
public class VNPayServiceImpl implements VNPayService {

    private static final DateTimeFormatter VNP_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final VNPayConfig vnPayConfig;

    public VNPayServiceImpl(VNPayConfig vnPayConfig) {
        this.vnPayConfig = vnPayConfig;
    }

    @Override
    public String createPaymentUrl(String txnRef, BigDecimal amount, String orderInfo, String ipAddress) {
        if (vnPayConfig.getTmnCode() == null || vnPayConfig.getTmnCode().isBlank()
                || vnPayConfig.getHashSecret() == null || vnPayConfig.getHashSecret().isBlank()) {
            log.error("VNPay configuration missing: tmnCode or hashSecret is not set.");
            throw new IllegalStateException("VNPay configuration is missing. Please set VNPAY_TMN_CODE and VNPAY_HASH_SECRET in your environment.");
        }

        String safeOrderInfo = VNPayUtil.sanitizeOrderInfo(
                (orderInfo != null && !orderInfo.isBlank()) ? orderInfo : "Thanh toan don hang " + txnRef
        );

        Map<String, String> params = new HashMap<>();
        params.put("vnp_Version", vnPayConfig.getVersion());
        params.put("vnp_Command", vnPayConfig.getCommand());
        params.put("vnp_TmnCode", vnPayConfig.getTmnCode());
        // VNPay expects the amount multiplied by 100 (no decimal places, e.g. 100,000 VND -> "10000000")
        params.put("vnp_Amount", amount.multiply(BigDecimal.valueOf(100)).setScale(0, java.math.RoundingMode.HALF_UP).toPlainString());
        params.put("vnp_CurrCode", vnPayConfig.getCurrCode());
        params.put("vnp_TxnRef", txnRef);
        params.put("vnp_OrderInfo", safeOrderInfo);
        params.put("vnp_OrderType", vnPayConfig.getOrderType());
        params.put("vnp_Locale", vnPayConfig.getLocale());
        params.put("vnp_ReturnUrl", vnPayConfig.getReturnUrl());
        params.put("vnp_IpAddr", VNPayUtil.normalizeIp(ipAddress));
        params.put("vnp_CreateDate", LocalDateTime.now().format(VNP_DATE_FORMAT));
        // Give the customer 15 minutes on VNPay's payment page before the request itself expires -
        // independent of / in addition to Boxora's own reservation soft-lock timer.
        params.put("vnp_ExpireDate", LocalDateTime.now().plusMinutes(15).format(VNP_DATE_FORMAT));

        SortedMap<String, String> sorted = VNPayUtil.sortParams(params);
        String hashData = VNPayUtil.buildHashData(sorted, StandardCharsets.UTF_8);
        String secureHash = VNPayUtil.hmacSHA512(vnPayConfig.getHashSecret(), hashData);

        StringBuilder query = new StringBuilder();
        sorted.forEach((key, value) -> query.append(key).append('=')
                .append(java.net.URLEncoder.encode(value, StandardCharsets.UTF_8)).append('&'));
        query.append("vnp_SecureHash=").append(secureHash);

        String paymentUrl = vnPayConfig.getPayUrl() + "?" + query;
        log.info("Generated VNPay payment URL for txnRef={}, amount={}", txnRef, amount);
        return paymentUrl;
    }

    @Override
    public boolean verifySignature(Map<String, String> params) {
        String receivedHash = params.get("vnp_SecureHash");
        if (receivedHash == null || receivedHash.isBlank()) {
            return false;
        }

        Map<String, String> paramsToVerify = new HashMap<>();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();
            if (key != null && key.startsWith("vnp_")
                    && !"vnp_SecureHash".equals(key)
                    && !"vnp_SecureHashType".equals(key)
                    && value != null && !value.isBlank()) {
                paramsToVerify.put(key, value);
            }
        }

        SortedMap<String, String> sorted = VNPayUtil.sortParams(paramsToVerify);

        // 1. Check with US_ASCII encoding (standard VNPay Java SDK)
        String hashDataAscii = VNPayUtil.buildHashData(sorted, StandardCharsets.US_ASCII);
        String computedHashAscii = VNPayUtil.hmacSHA512(vnPayConfig.getHashSecret(), hashDataAscii);
        if (computedHashAscii.equalsIgnoreCase(receivedHash)) {
            return true;
        }

        // 2. Check with UTF-8 encoding
        String hashDataUtf8 = VNPayUtil.buildHashData(sorted, StandardCharsets.UTF_8);
        String computedHashUtf8 = VNPayUtil.hmacSHA512(vnPayConfig.getHashSecret(), hashDataUtf8);
        if (computedHashUtf8.equalsIgnoreCase(receivedHash)) {
            return true;
        }

        // 3. Check with raw unencoded parameters
        String hashDataRaw = VNPayUtil.buildRawHashData(sorted);
        String computedHashRaw = VNPayUtil.hmacSHA512(vnPayConfig.getHashSecret(), hashDataRaw);
        if (computedHashRaw.equalsIgnoreCase(receivedHash)) {
            return true;
        }

        log.warn("VNPay signature mismatch for txnRef={}. Received={}, ComputedAscii={}",
                params.get("vnp_TxnRef"), receivedHash, computedHashAscii);
        return false;
    }
}
