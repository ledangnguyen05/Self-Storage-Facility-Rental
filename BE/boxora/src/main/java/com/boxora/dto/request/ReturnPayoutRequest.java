package com.boxora.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReturnPayoutRequest {

    @NotBlank(message = "Mã giao dịch ngân hàng không được để trống")
    @JsonAlias({"transactionRef", "txnRef"})
    private String transactionReference;

    @JsonAlias({"proofDocumentUrl", "proofUrl"})
    private String transferProofUrl;

    @JsonAlias({"notes", "processNotes"})
    private String processNotes;
}

