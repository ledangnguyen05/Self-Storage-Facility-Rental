package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StorageUnitUpdateRequest {

    @NotBlank(message = "Nhập mã kho")
    @Size(max = 30, message = "Mã kho tối đa 30 ký tự")
    @Pattern(regexp = "^\\s*[A-Za-z0-9][A-Za-z0-9._-]*\\s*$",
            message = "Mã kho chỉ gồm chữ cái, chữ số, dấu gạch ngang, gạch dưới hoặc dấu chấm, và không có khoảng trắng")
    private String unitCode;

    @NotBlank(message = "Nhập tầng của kho")
    @Size(max = 50, message = "Tên tầng tối đa 50 ký tự")
    @Pattern(regexp = "^[^<>]*$", message = "Tên tầng không được chứa ký tự < hoặc >")
    private String floorLevel;

    @NotNull(message = "Vui lòng chọn loại kho")
    private UUID unitTypeId;

    @Positive(message = "Đơn giá thuê phải lớn hơn 0")
    private java.math.BigDecimal pricePerMonth;

    private String priceChangeReason;
}
