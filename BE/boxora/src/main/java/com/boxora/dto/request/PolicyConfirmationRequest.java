package com.boxora.dto.request;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PolicyConfirmationRequest {

    @NotNull(message = "Mã đơn đặt kho (bookingId) không được để trống")
    private UUID bookingId;

    @NotNull(message = "Mã cơ sở (facilityId) không được để trống")
    private UUID facilityId;

    @NotBlank(message = "Phiên bản chính sách không được để trống")
    private String policyVersion;

    @NotNull(message = "Trạng thái đồng ý điều khoản không được để trống")
    @AssertTrue(message = "Quý khách phải đọc và xác nhận đồng ý với Điều khoản hủy hợp đồng & hoàn tiền")
    private Boolean agreed;
}
