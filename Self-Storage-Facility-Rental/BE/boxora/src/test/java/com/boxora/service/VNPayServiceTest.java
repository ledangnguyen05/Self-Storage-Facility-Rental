package com.boxora.service;

import com.boxora.config.VNPayConfig;
import com.boxora.service.impl.VNPayServiceImpl;
import com.boxora.util.VNPayUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.SortedMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class VNPayServiceTest {

    private VNPayConfig config;
    private VNPayServiceImpl vnPayService;

    @BeforeEach
    void setUp() {
        config = new VNPayConfig();
        config.setTmnCode("TESTTMN1");
        config.setHashSecret("SECRETKEY1234567890123456789012");
        config.setPayUrl("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");
        config.setReturnUrl("http://localhost:8080/api/v1/payments/vnpay-return");
        config.setVersion("2.1.0");
        config.setCommand("pay");
        config.setCurrCode("VND");
        config.setLocale("vn");
        config.setOrderType("other");

        vnPayService = new VNPayServiceImpl(config);
    }

    @Test
    @DisplayName("createPaymentUrl should generate valid URL containing required VNPay parameters")
    void testCreatePaymentUrl() {
        String txnRef = "BOX123456789";
        BigDecimal amount = new BigDecimal("500000"); // 500,000 VND
        String orderInfo = "Thanh toan don dat cho BOX123";
        String ipAddress = "127.0.0.1";

        String url = vnPayService.createPaymentUrl(txnRef, amount, orderInfo, ipAddress);

        assertThat(url).startsWith("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?");
        assertThat(url).contains("vnp_TmnCode=TESTTMN1");
        assertThat(url).contains("vnp_Amount=50000000"); // multiplied by 100
        assertThat(url).contains("vnp_TxnRef=BOX123456789");
        assertThat(url).contains("vnp_SecureHash=");
        assertThat(url).contains("vnp_ReturnUrl=");
    }

    @Test
    @DisplayName("createPaymentUrl should throw exception when configuration is missing")
    void testCreatePaymentUrlMissingConfig() {
        config.setTmnCode(null);
        assertThrows(IllegalStateException.class, () ->
                vnPayService.createPaymentUrl("REF1", BigDecimal.TEN, "info", "127.0.0.1")
        );
    }

    @Test
    @DisplayName("verifySignature should return true for authentic hash and false for tampered data")
    void testVerifySignature() {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_Amount", "10000000");
        params.put("vnp_BankCode", "NCB");
        params.put("vnp_CardType", "ATM");
        params.put("vnp_OrderInfo", "Thanh toan don hang");
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_TmnCode", "TESTTMN1");
        params.put("vnp_TransactionNo", "12345678");
        params.put("vnp_TransactionStatus", "00");
        params.put("vnp_TxnRef", "BOX999");

        SortedMap<String, String> sorted = VNPayUtil.sortParams(params);
        String hashData = VNPayUtil.buildHashData(sorted);
        String validHash = VNPayUtil.hmacSHA512(config.getHashSecret(), hashData);

        // Put correct hash
        params.put("vnp_SecureHash", validHash);
        assertThat(vnPayService.verifySignature(params)).isTrue();

        // Tamper parameter value
        params.put("vnp_Amount", "20000000");
        assertThat(vnPayService.verifySignature(params)).isFalse();
    }
}
