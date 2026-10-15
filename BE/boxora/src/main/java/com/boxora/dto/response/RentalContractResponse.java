package com.boxora.dto.response;

import com.boxora.enums.RentalContractStatus;
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
public class RentalContractResponse {

    private UUID id;
    private String contractCode;

    private UUID customerId;
    private String customerName;
    private String customerEmail;
    private String customerPhone;

    private UUID unitId;
    private String unitCode;

    private UUID facilityId;
    private String facilityName;

    private UUID bookingId;

    private LocalDate startDate;
    private LocalDate endDate;
    private BigDecimal monthlyFee;
    private BigDecimal depositHeld;

    private RentalContractStatus status;

    private Long docusealSubmissionId;
    private String docusealSubmitterSlug;
    private String signingUrl;
    private String signedDocumentUrl;
    private LocalDateTime signedAt;
    private String signatureData;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
