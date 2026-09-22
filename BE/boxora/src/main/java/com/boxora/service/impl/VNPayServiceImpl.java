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
@RequiredArgsConstructor
@Slf4j
public class VNPayServiceImpl implements VNPayService {

    private static final DateTimeFormatter VNP_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final VNPayConfig vnPayConfig;

    @Override
    public String createPaymentUrl(String txnRef, BigDecimal amount, String orderInfo, String ipAddress) {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_Version", vnPayConfig.getVersion());
        params.put("vnp_Command", vnPayConfig.getCommand());
        params.put("vnp_TmnCode", vnPayConfig.getTmnCode());
        // VNPay expects the amount multiplied by 100 (no decimal places, e.g. 100,000 VND -> "10000000")
        params.put("vnp_Amount", amount.multiply(BigDecimal.valueOf(100)).setScale(0, java.math.RoundingMode.HALF_UP).toPlainString());
        params.put("vnp_CurrCode", vnPayConfig.getCurrCode());
        params.put("vnp_TxnRef", txnRef);
        params.put("vnp_OrderInfo", orderInfo);
        params.put("vnp_OrderType", vnPayConfig.getOrderType());
        params.put("vnp_Locale", vnPayConfig.getLocale());
        params.put("vnp_ReturnUrl", vnPayConfig.getReturnUrl());
        params.put("vnp_IpAddr", VNPayUtil.normalizeIp(ipAddress));
        params.put("vnp_CreateDate", LocalDateTime.now().format(VNP_DATE_FORMAT));
        // Give the customer 15 minutes on VNPay's payment page before the request itself expires -
        // independent of / in addition to Boxora's own reservation soft-lock timer.
        params.put("vnp_ExpireDate", LocalDateTime.now().plusMinutes(15).format(VNP_DATE_FORMAT));

        SortedMap<String, String> sorted = VNPayUtil.sortParams(params);
        String hashData = VNPayUtil.buildHashData(sorted);
        String secureHash = VNPayUtil.hmacSHA512(vnPayConfig.getHashSecret(), hashData);

        StringBuilder query = new StringBuilder();
        sorted.forEach((key, value) -> query.append(key).append('=')
                .append(java.net.URLEncoder.encode(value, StandardCharsets.US_ASCII)).append('&'));
        query.append("vnp_SecureHash=").append(secureHash);

        return vnPayConfig.getPayUrl() + "?" + query;
    }

    @Override
    public boolean verifySignature(Map<String, String> params) {
        String receivedHash = params.get("vnp_SecureHash");
        if (receivedHash == null || receivedHash.isBlank()) {
            return false;
        }

        Map<String, String> paramsToVerify = new HashMap<>(params);
        paramsToVerify.remove("vnp_SecureHash");
        paramsToVerify.remove("vnp_SecureHashType");

        SortedMap<String, String> sorted = VNPayUtil.sortParams(paramsToVerify);
        String hashData = VNPayUtil.buildHashData(sorted);
        String computedHash = VNPayUtil.hmacSHA512(vnPayConfig.getHashSecret(), hashData);

        boolean valid = computedHash.equalsIgnoreCase(receivedHash);
        if (!valid) {
            log.warn("VNPay signature mismatch for txnRef={}", params.get("vnp_TxnRef"));
        }
        return valid;
    }
}