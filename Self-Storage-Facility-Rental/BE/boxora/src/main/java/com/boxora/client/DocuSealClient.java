package com.boxora.client;

import com.boxora.config.DocuSealConfig;
import com.boxora.dto.request.DocuSealSubmissionRequest;
import com.boxora.dto.response.DocuSealSubmitterResponse;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DocuSealClient {

    private final DocuSealConfig config;
    private final ObjectMapper objectMapper;

    private RestClient client() {
        return RestClient.builder()
                .baseUrl(config.getApiUrl())
                .defaultHeader("X-Auth-Token", config.getApiKey())
                .defaultHeader("Content-Type", "application/json")
                .build();
    }

    public List<DocuSealSubmitterResponse> createSubmission(DocuSealSubmissionRequest request) {
        try {
            log.info("Sending submission request to DocuSeal at {} templateId={}", config.getApiUrl(), request.getTemplate_id());
            String responseStr = client().post()
                    .uri("/submissions")
                    .body(request)
                    .retrieve()
                    .body(String.class);

            if (responseStr == null || responseStr.isBlank()) {
                throw new AppException(ErrorCode.CONTRACT_SIGNING_FAILED);
            }

            JsonNode root = objectMapper.readTree(responseStr);
            if (root.isArray()) {
                return objectMapper.readerForListOf(DocuSealSubmitterResponse.class).readValue(root);
            } else if (root.has("submitters") && root.get("submitters").isArray()) {
                return objectMapper.readerForListOf(DocuSealSubmitterResponse.class).readValue(root.get("submitters"));
            } else {
                DocuSealSubmitterResponse single = objectMapper.treeToValue(root, DocuSealSubmitterResponse.class);
                return List.of(single);
            }
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to create DocuSeal submission: {}", e.getMessage(), e);
            throw new AppException(ErrorCode.CONTRACT_SIGNING_FAILED);
        }
    }
}