package com.boxora.dto.response;

import com.boxora.enums.RentalContractStatus;
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
@Schema(description = "Chi tiết một hợp đồng quá hạn và các biện pháp xử lý theo mốc thời gian (+1, +3, +7)")
public class OverdueContractDetail {

    private UUID contractId;
    private String contractCode;
    private UUID customerId;
    private String customerName;
    private String customerEmail;
    private UUID storageUnitId;
    private String unitCode;
    private UUID facilityId;
    private String facilityName;
    private LocalDate endDate;
    private Long overdueDays;
    private BigDecimal monthlyFee;
    private RentalContractStatus contractStatus;

    // Mốc +1 ngày: Phạt 5%
    private Boolean latePenaltyApplied;
    private BigDecimal latePenaltyAmount;

    // Mốc +3 ngày: Khóa PIN
    private Boolean pinAccessDisabled;

    // Mốc +7 ngày: Niêm phong kho BR-RULE-012
    private Boolean unitSealed;
    private String sealTagNumber;

    private String actionSummary;
}
