package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StorageUnitResponse {
    private UUID id;
    private String unitCode;
    private String floorLevel;
    private String status;
    private UUID facilityId;
    private String facilityName;
    private UUID unitTypeId;
    private String unitTypeName;
    private BigDecimal pricePerMonth;
    private BigDecimal depositAmount;
    private Double areaSqMeters;
    private String batteryLevel;
    private String smartLockSerial;
    private String lastAccessTime;
    private UUID bookingId;
    private String tenantName;
    private String contractCode;
    private UUID contractId;
    private String startDate;
    private String dueDate;
}
