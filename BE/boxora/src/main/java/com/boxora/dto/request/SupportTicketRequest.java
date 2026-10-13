package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
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

    @NotBlank(message = "Category is required")
    private String category;

    @NotBlank(message = "Title is required")
    private String title;

    @NotBlank(message = "Description is required")
    private String description;

    private String priority;

    /** URL ảnh hoặc danh sách URL ảnh bằng chứng sự cố (ví dụ kẹt khóa, rách cửa) */
    private String imageEvidence;

    /** Danh sách URLs ảnh bằng chứng */
    private List<String> evidenceUrls;
}
