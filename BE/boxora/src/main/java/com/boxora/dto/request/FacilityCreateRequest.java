package com.boxora.dto.request;

import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FacilityCreateRequest {

    @NotBlank(message = "Nhập tên cơ sở")
    @Size(min = 2, max = 150, message = "Tên cơ sở từ 2 đến 150 ký tự")
    @Pattern(regexp = "^[^<>]*$", message = "Tên cơ sở không được chứa ký tự < hoặc >")
    private String name;

    @NotBlank(message = "Nhập mã cơ sở")
    @Size(min = 2, max = 30, message = "Mã cơ sở từ 2 đến 30 ký tự")
    @Pattern(regexp = "^\\s*[A-Za-z0-9][A-Za-z0-9._-]*\\s*$",
            message = "Mã cơ sở chỉ gồm chữ cái, chữ số, dấu gạch ngang, gạch dưới hoặc dấu chấm, và không có khoảng trắng")
    private String code;

    @NotBlank(message = "Nhập địa chỉ cơ sở")
    @Size(max = 255, message = "Địa chỉ tối đa 255 ký tự")
    private String address;

    @Size(max = 50, message = "Thành phố tối đa 50 ký tự")
    private String city;

    @Size(max = 20, message = "Số điện thoại tối đa 20 ký tự")
    private String contactPhone;

    @Email(message = "Email không hợp lệ")
    @Size(max = 150, message = "Email tối đa 150 ký tự")
    private String email;

    private UUID managerId;

    /** Trạng thái ban đầu: ACTIVE, MAINTENANCE hoặc INACTIVE. Bỏ trống = ACTIVE. */
    private String status;

    private LocalTime openTime;
    private LocalTime closeTime;

    private String description;

    /** Chấp nhận nhiều chữ số thập phân (kết quả geocoding); service làm tròn về 7 chữ số khi lưu. */
    @Digits(integer = 3, fraction = 15, message = "Vĩ độ không hợp lệ")
    @DecimalMin(value = "-90.0", message = "Vĩ độ nằm trong khoảng -90 đến 90")
    @DecimalMax(value = "90.0", message = "Vĩ độ nằm trong khoảng -90 đến 90")
    private BigDecimal latitude;

    @Digits(integer = 3, fraction = 15, message = "Kinh độ không hợp lệ")
    @DecimalMin(value = "-180.0", message = "Kinh độ nằm trong khoảng -180 đến 180")
    @DecimalMax(value = "180.0", message = "Kinh độ nằm trong khoảng -180 đến 180")
    private BigDecimal longitude;

    private String layoutConfig;
}
