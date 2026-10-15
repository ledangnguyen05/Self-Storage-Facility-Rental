package com.boxora.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContractMockSignRequest {

    @Schema(description = "Chữ ký tay của khách hàng dưới dạng Base64 data URL (PNG) hoặc chuỗi số hóa")
    private String signatureData;
}
