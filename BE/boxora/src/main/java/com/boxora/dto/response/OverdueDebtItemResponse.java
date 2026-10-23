package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OverdueDebtItemResponse {
    private UUID contractId;
    private String contractCode;
    private UUID bookingId;
    private String bookingCode;
    private UUID customerId;
    private String customerName;
    private String customerPhone;
    private String customerEmail;
    private UUID unitId;
    private String unitCode;
    private UUID facilityId;
    private String facilityName;
    private LocalDate startDate;
    private LocalDate dueDate;
    private long daysOverdue;
    private BigDecimal unpaidRent;
    private BigDecimal dailyLateFee;
    private BigDecimal totalLateFee;
    private BigDecimal totalDebt;
    private String overdueStage; // GRACE_PERIOD, WARNING, ACCESS_BLOCKED, ELIGIBLE_FOR_SEALING, POLICY_UNCONFIGURED
    private String smartLockStatus; // UNVERIFIED unless a physical device reports its actual state
}
