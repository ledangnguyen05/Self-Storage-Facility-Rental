package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContractSigningUrlResponse {
    private UUID contractId;
    private Long submissionId;
    private String slug;
    private String signingUrl;
}
