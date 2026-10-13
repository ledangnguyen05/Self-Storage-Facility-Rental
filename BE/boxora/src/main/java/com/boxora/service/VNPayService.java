package com.boxora.service;

import java.math.BigDecimal;
import java.util.Map;

public interface VNPayService {

    String createPaymentUrl(String txnRef, BigDecimal amount, String orderInfo, String ipAddress);
    boolean verifySignature(Map<String, String> params);
}