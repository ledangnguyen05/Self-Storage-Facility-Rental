package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupportTicketContactLogRequest {

    @NotBlank(message = "Phương thức liên hệ không được để trống")
    private String contactMethod; // PHONE, EMAIL, INTERNAL_CHAT

    @NotBlank(message = "Thông tin đầu mối liên hệ không được để trống")
    private String contactTarget; // Email or phone number

    @NotBlank(message = "Nội dung tóm tắt sự cố cần hỗ trợ không được để trống")
    private String summary;

    private String result; // Kết quả trao đổi / hướng chỉ đạo từ BOM
}
