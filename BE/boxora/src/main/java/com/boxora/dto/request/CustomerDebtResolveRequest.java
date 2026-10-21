package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomerDebtResolveRequest {

    /** COLLECTED (đã thu hồi) hoặc WRITTEN_OFF (xóa nợ). */
    @NotBlank(message = "Vui lòng chọn kết quả xử lý công nợ")
    private String status;

    @NotBlank(message = "Vui lòng ghi chú cách xử lý công nợ")
    @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
    private String note;
}
