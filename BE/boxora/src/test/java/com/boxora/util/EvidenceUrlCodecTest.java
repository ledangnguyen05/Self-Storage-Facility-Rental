package com.boxora.util;

import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class EvidenceUrlCodecTest {

    @Test
    @DisplayName("encode/decode round-trips a list of uploaded urls")
    void roundTrip() {
        List<String> urls = List.of("/uploads/handover/a.jpg", "/uploads/handover/b.pdf");
        assertThat(EvidenceUrlCodec.decode(EvidenceUrlCodec.encode(urls))).containsExactlyElementsOf(urls);
        assertThat(EvidenceUrlCodec.encode(List.of())).isNull();
        assertThat(EvidenceUrlCodec.decode(null)).isEmpty();
    }

    @Test
    @DisplayName("legacy ';' joined rows are still readable and base64 fragments are dropped instead of shown as broken images")
    void legacyFormat() {
        assertThat(EvidenceUrlCodec.decode("/uploads/tickets/a.jpg;/uploads/tickets/b.jpg"))
                .containsExactly("/uploads/tickets/a.jpg", "/uploads/tickets/b.jpg");
        assertThat(EvidenceUrlCodec.decode("data:image/jpeg;base64,AAAA;data:image/png;base64,BBBB")).isEmpty();
    }

    @Test
    @DisplayName("only files uploaded through the handover endpoint are accepted")
    void validation() {
        assertThat(EvidenceUrlCodec.requireUploadedUrl("/uploads/handover/3f2c1e0a-1111-2222-3333-444455556666.jpg"))
                .isEqualTo("/uploads/handover/3f2c1e0a-1111-2222-3333-444455556666.jpg");
        assertThat(EvidenceUrlCodec.requireUploadedUrl("  ")).isNull();
        for (String bad : List.of("data:image/png;base64,AAAA", "https://evil.example/x.jpg", "/uploads/tickets/a.jpg",
                "/uploads/handover/../../secret", "javascript:alert(1)")) {
            AppException ex = assertThrows(AppException.class, () -> EvidenceUrlCodec.requireUploadedUrl(bad));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_EVIDENCE_URL_INVALID);
        }
    }
}
