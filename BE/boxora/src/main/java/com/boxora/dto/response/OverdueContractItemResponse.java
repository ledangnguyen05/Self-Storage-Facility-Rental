package com.boxora.dto.response;

import com.boxora.enums.OverduePinStatus;
import com.boxora.enums.OverdueSealingStatus;
import com.boxora.enums.OverdueStage;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OverdueContractItemResponse {
    private UUID contractId;
    private String contractCode;
    private UUID bookingId;
    private String bookingCode;
    private UUID unitId;
    private String unitCode;
    private UUID facilityId;
    private String facilityName;
    private UUID customerId;
    private String customerName;
    private String customerPhone;
    private String customerEmail;

    private LocalDate startDate;
    private LocalDate dueDate;
    private long daysOverdue;

    private BigDecimal principalDebt;
    private BigDecimal dailyLateFee;
    private BigDecimal lateFee;
    private BigDecimal totalDebt;
    private BigDecimal unverifiedAmount;

    private OverdueStage stage;
    private String stageLabel;

    private OverduePinStatus pinStatus;
    private OverdueSealingStatus sealingStatus;
    private String smartLockOnlineStatus; // ONLINE / OFFLINE
    private Boolean smartLockIsMock;
    private Boolean isDemo;
    private Boolean hasActivePolicy;

    private LocalDateTime lastReminderSentAt;
    private long reminderCount;
}

