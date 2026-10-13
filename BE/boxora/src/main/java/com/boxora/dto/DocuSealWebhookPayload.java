package com.boxora.dto;


import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class DocuSealWebhookPayload {
    private String event_type;       // "form.completed", "form.viewed", ...
    private Map<String, Object> data; // chứa submission/submitter info + documents[]
}
