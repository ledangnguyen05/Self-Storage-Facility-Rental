package com.boxora.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Kết quả xử lý quá hạn của một hợp đồng trong một lượt chạy")
public class OverdueContractDetail {

    private UUID contractId;
    private String contractCode;
    private UUID storageUnitId;
    private String unitCode;
    private UUID facilityId;
    private String facilityName;
    private LocalDate endDate;
    private int overdueDays;
    private String contractStatus;
    /** GRACE_PERIOD, WARNING, ACCESS_BLOCKED or ELIGIBLE_FOR_SEALING. */
    private String overdueStage;
    private BigDecimal lateFeeAmount;
    private boolean accessLocked;
    private boolean sealed;
    private String actionSummary;
}
