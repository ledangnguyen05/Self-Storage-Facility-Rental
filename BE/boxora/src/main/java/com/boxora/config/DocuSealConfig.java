package com.boxora.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "docuseal")
@Getter
@Setter
public class DocuSealConfig {
    private String apiUrl;
    private String apiKey;
    private Long templateId;
    private Long renewalTemplateId;
    private String webhookToken;
    private Boolean mockEnabled = false;

    public boolean isMockActive() {
        return Boolean.TRUE.equals(mockEnabled) || (apiKey == null || apiKey.trim().isEmpty());
    }

    public Long getEffectiveRenewalTemplateId() {
        return renewalTemplateId != null ? renewalTemplateId : templateId;
    }

    public String getWebBaseUrl() {
        if (apiUrl == null || apiUrl.isBlank()) {
            return "http://localhost:3000";
        }
        String cleanUrl = apiUrl.trim();
        if (cleanUrl.endsWith("/")) {
            cleanUrl = cleanUrl.substring(0, cleanUrl.length() - 1);
        }
        if (cleanUrl.endsWith("/api")) {
            cleanUrl = cleanUrl.substring(0, cleanUrl.length() - 4);
        }
        if (cleanUrl.contains("api.docuseal.com")) {
            return "https://docuseal.com";
        }
        return cleanUrl;
    }
}