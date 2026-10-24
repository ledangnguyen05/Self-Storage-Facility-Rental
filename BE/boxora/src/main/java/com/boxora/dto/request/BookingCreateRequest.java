package com.boxora.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingCreateRequest {
    @NotNull(message = "Storage unit ID is required")
    private UUID storageUnitId;

    /** ID cơ sở lưu trữ được khách chọn ở Bước 1 */
    private UUID facilityId;

    private UUID customerId;

    /** Họ và tên người đặt */
    private String fullName;

    /** Số điện thoại liên hệ */
    private String phone;

    /** Địa chỉ email nhận phiếu hẹn */
    private String email;

    /** Ghi chú yêu cầu đặc biệt */
    private String specialNotes;

    @NotNull(message = "Start date is required")
    private LocalDate startDate;

    private LocalDateTime expectedArrivalAt;

    private Boolean requiresManagerApproval;

    @NotNull(message = "Rental duration in months is required")
    private Integer rentalMonths;

    private BigDecimal totalRentalFee;

    private BigDecimal depositPaid;

    private BigDecimal depositAmount;

    private String signingMethod;

    private String discountCode;

    /** Ngày và giờ dự kiến đến cơ sở nhận kho */
    private java.time.LocalDateTime expectedCheckInAt;

    /** Giờ dự kiến đến cơ sở nhận kho (ví dụ: "14:00") */
    private String checkInTime;

    /** Số Căn cước công dân hoặc Hộ chiếu */
    private String identityCardNumber;

    /** Loại giấy tờ định danh (CCCD hoặc PASSPORT) */
    private String identityCardType;
}
