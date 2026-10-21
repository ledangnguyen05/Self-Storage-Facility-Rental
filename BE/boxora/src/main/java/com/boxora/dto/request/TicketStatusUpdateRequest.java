package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketStatusUpdateRequest {
    @NotBlank(message = "Chọn trạng thái mới của phiếu")
    private String status;

    @Size(max = 2000, message = "Ghi chú tối đa 2.000 ký tự")
    private String note;
    private String priority;
    private List<String> evidenceUrls;
}
