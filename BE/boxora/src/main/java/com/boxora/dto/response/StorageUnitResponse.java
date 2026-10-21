package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Thông tin một kho. Nhóm trường đầu (đến {@code areaSqMeters}) là thông tin công khai trả cho mọi người.
 * Nhóm "thông tin thuê" ({@code bookingId} trở xuống) chỉ có giá trị với nhân viên, quản lý cơ sở, giám đốc vận hành
 * và quản trị viên; khách vãng lai và khách hàng luôn nhận {@code null}.
 *
 * <p>Backend chưa tích hợp khóa thông minh thật nên không còn trả pin khóa, số seri khóa hay lần mở gần nhất
 * (trước đây là số liệu bịa).
 */
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
    /** Đơn giá thuê một tháng đang niêm yết (cùng nguồn với báo giá). */
    private BigDecimal pricePerMonth;
    /** Tiền cọc = đơn giá tháng x tỷ lệ cọc của chính sách cơ sở. */
    private BigDecimal depositAmount;
    private Double areaSqMeters;

    // --- Thông tin thuê: chỉ dành cho tài khoản nội bộ ---
    private UUID bookingId;
    private String bookingCode;
    private String tenantName;
    private String contractCode;
    private UUID contractId;
    private String startDate;
    private String dueDate;
}
