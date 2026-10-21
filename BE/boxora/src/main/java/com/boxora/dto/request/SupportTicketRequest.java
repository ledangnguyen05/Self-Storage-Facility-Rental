package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupportTicketRequest {
    private UUID customerId;
    private UUID bookingId;
    private UUID facilityId;

    @NotBlank(message = "Chọn danh mục sự cố")
    private String category;

    @NotBlank(message = "Nhập tiêu đề sự cố")
    @Size(max = 255, message = "Tiêu đề tối đa 255 ký tự")
    private String title;

    @NotBlank(message = "Mô tả sự cố không được để trống")
    @Size(max = 4000, message = "Mô tả tối đa 4.000 ký tự")
    private String description;

    private String priority;

    /** URL ảnh hoặc danh sách URL ảnh bằng chứng sự cố (ví dụ kẹt khóa, rách cửa) */
    private String imageEvidence;

    /** Danh sách URLs ảnh bằng chứng */
    private List<String> evidenceUrls;
}
