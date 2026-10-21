package com.boxora.dto.response;

import com.boxora.enums.FacilityStatus;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

@Data
@AllArgsConstructor
@Builder
public class FacilityResponse {
    private UUID id;
    private String name;
    private String code;
    private String address;
    private String city;
    private String contactPhone;
    private String email;

    /** Chỉ có giá trị với tài khoản nội bộ; khách vãng lai và khách hàng không nhận thông tin người quản lý. */
    private UUID managerId;
    private String managerName;

    private FacilityStatus status;
    private LocalTime openTime;
    private LocalTime closeTime;
    private String description;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String layoutConfig;

    /** Tổng số kho của cơ sở (mọi trạng thái). */
    private Long totalUnits;
    /** Số kho đang trống và có thể thuê ngay; bằng 0 khi cơ sở không ở trạng thái hoạt động. */
    private Long availableUnits;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
