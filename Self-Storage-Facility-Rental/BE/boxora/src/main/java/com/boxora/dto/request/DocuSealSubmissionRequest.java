package com.boxora.dto.request;

import lombok.*;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocuSealSubmissionRequest {
    private Long template_id;
    private boolean send_email;
    private List<Submitter> submitters;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Submitter {
        private String role;         // phải khớp đúng role name đã đặt trong template DocuSeal
        private String email;
        private String name;
        private String external_id;  // mình dùng contract.id để đối chiếu ngược lúc nhận webhook
        private List<Field> fields;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Field {
        private String name;
        private String default_value;
    }
}