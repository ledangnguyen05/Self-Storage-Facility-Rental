package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefundTransferRequest {

    @NotBlank(message = "Mã tham chiếu hoặc ủy nhiệm chi không được để trống")
    @Size(max = 100, message = "Mã tham chiếu không được quá 100 ký tự")
    private String transferReference;

    @Size(max = 500, message = "Ghi chú không được quá 500 ký tự")
    private String transferNotes;

    /** URL returned by POST /refunds/{id}/transfer-evidence (bank transfer slip), optional. */
    @Size(max = 500, message = "Đường dẫn minh chứng tối đa 500 ký tự")
    private String transferEvidenceUrl;
}
