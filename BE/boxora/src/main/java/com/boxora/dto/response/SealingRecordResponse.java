package com.boxora.dto.response;

import com.boxora.enums.SealingStatus;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SealingRecordResponse {

    private UUID id;
    private String protocolNumber;

    private UUID contractId;
    private String contractCode;

    private UUID unitId;
    private String unitCode;

    private UUID facilityId;
    private String facilityName;

    private UUID customerId;
    private String customerName;
    private String customerEmail;
    private String customerPhone;

    private UUID performedById;
    private String performedByName;

    private UUID witnessId;
    private String witnessName;

    private String sealTagNumber;
    private String reason;
    private Long overdueDays;
    private BigDecimal totalDebtAmount;

    private String inventorySummary;
    private String notes;
    private String evidenceUrls;

    private SealingStatus status;
    private LocalDateTime sealedAt;

    private LocalDateTime unsealedAt;
    private UUID unsealedById;
    private String unsealedByName;
    private String unsealReason;

    private LocalDateTime createdAt;
}
