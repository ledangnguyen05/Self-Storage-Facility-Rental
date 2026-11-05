package com.boxora.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ReturnPayoutRequest {

    @NotBlank(message = "Mã giao dịch ngân hàng không được để trống")
    @JsonAlias({"transactionRef", "txnRef"})
    private String transactionReference;

    @JsonAlias({"proofDocumentUrl", "proofUrl"})
    private String transferProofUrl;

    @JsonAlias({"notes", "processNotes"})
    private String processNotes;

    public ReturnPayoutRequest() {
    }

    public ReturnPayoutRequest(String transactionReference, String transferProofUrl, String processNotes) {
        this.transactionReference = transactionReference;
        this.transferProofUrl = transferProofUrl;
        this.processNotes = processNotes;
    }

    public static ReturnPayoutRequestBuilder builder() {
        return new ReturnPayoutRequestBuilder();
    }

    public static class ReturnPayoutRequestBuilder {
        private String transactionReference;
        private String transferProofUrl;
        private String processNotes;

        public ReturnPayoutRequestBuilder transactionReference(String transactionReference) {
            this.transactionReference = transactionReference;
            return this;
        }

        public ReturnPayoutRequestBuilder transferProofUrl(String transferProofUrl) {
            this.transferProofUrl = transferProofUrl;
            return this;
        }

        public ReturnPayoutRequestBuilder processNotes(String processNotes) {
            this.processNotes = processNotes;
            return this;
        }

        public ReturnPayoutRequest build() {
            return new ReturnPayoutRequest(transactionReference, transferProofUrl, processNotes);
        }

        @Override
        public String toString() {
            return "ReturnPayoutRequest.ReturnPayoutRequestBuilder(transactionReference=" + this.transactionReference
                    + ", transferProofUrl=" + this.transferProofUrl
                    + ", processNotes=" + this.processNotes + ")";
        }
    }
}
