package com.boxora.dto.response;

import com.boxora.enums.ContractRenewalStatus;
import com.boxora.enums.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContractRenewalResponse {

    private UUID id;
    private UUID contractId;
    private String contractCode;

    private UUID customerId;
    private String customerName;
    private String customerEmail;

    private String facilityName;
    private String unitCode;

    private LocalDate oldEndDate;
    private LocalDate newEndDate;
    private Integer cycleMonths;
    private BigDecimal renewalFee;

    private ContractRenewalStatus status;

    private UUID paymentId;
    private PaymentStatus paymentStatus;

    private Long docusealSubmissionId;
    private String docusealSubmitterSlug;
    private String signingUrl;
    private String signedDocumentUrl;
    private LocalDateTime signedAt;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
