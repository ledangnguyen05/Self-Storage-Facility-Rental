package com.boxora.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContractRenewalReceptionRequest {

    @NotNull(message = "Bắt buộc phải xác minh danh tính và quyền gia hạn")
    private Boolean identityVerified;

    private String identityDocType;
    private String identityNumber;
    private String identityNotes;

    @NotNull(message = "Bắt buộc phải đối soát hợp đồng và hiện trạng kho")
    private Boolean unitAudited;

    private String unitAuditNotes;

    @NotNull(message = "Bắt buộc phải xác nhận không có trạng thái chặn gia hạn")
    private Boolean noBlockingIssues;

    private String blockingNotes;

    @NotNull(message = "Bắt buộc phải xác nhận đơn giá, thời hạn và các khoản phí")
    private Boolean termsConfirmed;

    private String termsNotes;

    @NotNull(message = "Bắt buộc phải hoàn tất thanh toán")
    private Boolean paymentConfirmed;

    private String paymentMethod;
    private String receiptVoucherCode;
    private String signatureData;

    private String receptionNotes;
}
