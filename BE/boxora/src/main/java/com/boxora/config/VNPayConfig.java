package com.boxora.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "vnpay")
@Getter
@Setter
public class VNPayConfig {

    /** vnp_TmnCode - merchant website code issued by VNPay (sandbox test value from the merchant portal). */
    private String tmnCode;

    /** Secret key used to sign/verify vnp_SecureHash (HMAC-SHA512). */
    private String hashSecret;

    /** Sandbox payment page: https://sandbox.vnpayment.vn/paymentv2/vpcpay.html */
    private String payUrl;

    /** Where VNPay redirects the customer's browser back to after payment (informational only). */
    private String returnUrl;

    /** vnp_Version required by VNPay's API contract. */
    private String version = "2.1.0";

    /** vnp_Command for a payment request. */
    private String command = "pay";

    private String currCode = "VND";

    private String locale = "vn";

    /** vnp_OrderType - VNPay's fixed category code for "other" services. */
    private String orderType = "other";

    public String getVersion() {
        return (version != null && !version.isBlank()) ? version : "2.1.0";
    }

    public String getCommand() {
        return (command != null && !command.isBlank()) ? command : "pay";
    }

    public String getCurrCode() {
        return (currCode != null && !currCode.isBlank()) ? currCode : "VND";
    }

    public String getLocale() {
        return (locale != null && !locale.isBlank()) ? locale : "vn";
    }

    public String getOrderType() {
        return (orderType != null && !orderType.isBlank()) ? orderType : "other";
    }
}