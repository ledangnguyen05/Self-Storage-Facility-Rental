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
public class CustomerDecisionRequest {

    /** AGREED hoặc DISPUTED */
    @NotBlank(message = "Quyết định của khách hàng không được để trống (AGREED hoặc DISPUTED)")
    private String decision;

    /** Bắt buộc nếu decision = DISPUTED */
    private String disputeReason;

    /** URL ảnh/tài liệu bằng chứng nếu có */
    private String disputeEvidenceUrls;

    /** Phiên bản quyết toán mà khách hàng đang phản hồi (tùy chọn để bảo vệ chống stale decision) */
    private Integer settlementVersion;

    /** Thông tin tài khoản ngân hàng nhận hoàn tiền (nếu được hoàn) */
    private String bankName;
    private String bankAccountNumber;
    private String bankAccountName;
}
