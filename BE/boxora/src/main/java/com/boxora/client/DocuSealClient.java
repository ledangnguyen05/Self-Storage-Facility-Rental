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
                .defaultHeader("X-Auth-Token", config.getApiKey() != null ? config.getApiKey() : "")
                .defaultHeader("Content-Type", "application/json")
                .build();
    }

    public List<DocuSealSubmitterResponse> createSubmission(DocuSealSubmissionRequest request) {
        if (config.isMockActive()) {
            log.info("DocuSeal is running in simulation/mock mode (apiKey empty or mockEnabled=true). Emulating submission for templateId={}",
                    request.getTemplate_id());
            DocuSealSubmitterResponse mock = new DocuSealSubmitterResponse();
            mock.setId(System.currentTimeMillis() % 100000);
            mock.setSubmission_id(System.currentTimeMillis() % 1000000);
            mock.setSlug("mock-" + java.util.UUID.randomUUID().toString().substring(0, 8));
            mock.setStatus("pending");
            if (request.getSubmitters() != null && !request.getSubmitters().isEmpty()) {
                mock.setEmail(request.getSubmitters().get(0).getEmail());
                mock.setExternal_id(request.getSubmitters().get(0).getExternal_id());
            }
            return List.of(mock);
        }

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