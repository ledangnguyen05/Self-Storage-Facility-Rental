package com.boxora.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class DocuSealSubmitterResponse {
    private Long id;
    private Long submission_id;
    private String email;
    private String slug;       // dùng ghép link ký: {apiUrl gốc web, không phải /api}/s/{slug}
    private String status;
    private String external_id;
    private String embed_src;
    private String link;
}