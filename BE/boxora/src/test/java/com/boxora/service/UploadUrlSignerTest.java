package com.boxora.service;

import com.boxora.service.impl.UploadUrlSigner;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class UploadUrlSignerTest {

    private static final String PATH = "/uploads/handover/9f1c2d3e-0000-4000-8000-000000000001.jpg";
    private static final Instant NOW = Instant.parse("2026-10-21T08:00:00Z");

    private static UploadUrlSigner signerAt(Instant now, String secret) {
        return new UploadUrlSigner(secret, 900, Clock.fixed(now, ZoneOffset.UTC));
    }

    private static String queryValue(String signedUrl, String key) {
        String query = signedUrl.substring(signedUrl.indexOf('?') + 1);
        for (String part : query.split("&")) {
            if (part.startsWith(key + "=")) {
                return part.substring(key.length() + 1);
            }
        }
        return null;
    }

    @Test
    @DisplayName("Link ký số hợp lệ trong thời hạn")
    void signedLink_isAcceptedBeforeItExpires() {
        UploadUrlSigner signer = signerAt(NOW, "a-long-test-secret-for-signing");
        String signed = signer.sign(PATH);

        assertThat(signed).startsWith(PATH + "?exp=");
        long exp = Long.parseLong(queryValue(signed, "exp"));
        assertThat(exp).isEqualTo(NOW.getEpochSecond() + 900);
        assertThat(signer.verify(PATH, exp, queryValue(signed, "sig"))).isTrue();
    }

    @Test
    @DisplayName("Link hết hạn bị từ chối, kể cả khi chữ ký đúng")
    void expiredLink_isRejected() {
        String signed = signerAt(NOW, "a-long-test-secret-for-signing").sign(PATH);
        long exp = Long.parseLong(queryValue(signed, "exp"));
        String sig = queryValue(signed, "sig");

        UploadUrlSigner later = signerAt(NOW.plus(Duration.ofSeconds(901)), "a-long-test-secret-for-signing");
        assertThat(later.verify(PATH, exp, sig)).isFalse();
        UploadUrlSigner justBefore = signerAt(NOW.plus(Duration.ofSeconds(900)), "a-long-test-secret-for-signing");
        assertThat(justBefore.verify(PATH, exp, sig)).isTrue();
    }

    @Test
    @DisplayName("Chữ ký không dùng lại được cho tệp khác, hạn khác hoặc khóa khác")
    void signatureIsBoundToPathExpiryAndKey() {
        UploadUrlSigner signer = signerAt(NOW, "a-long-test-secret-for-signing");
        String signed = signer.sign(PATH);
        long exp = Long.parseLong(queryValue(signed, "exp"));
        String sig = queryValue(signed, "sig");

        assertThat(signer.verify("/uploads/handover/other.jpg", exp, sig)).isFalse();
        assertThat(signer.verify("/uploads/refunds/9f1c2d3e-0000-4000-8000-000000000001.jpg", exp, sig)).isFalse();
        assertThat(signer.verify(PATH, exp + 3600, sig)).isFalse();
        assertThat(signer.verify(PATH, exp, sig.substring(0, sig.length() - 1) + (sig.endsWith("A") ? "B" : "A"))).isFalse();
        assertThat(signerAt(NOW, "another-secret-another-secret").verify(PATH, exp, sig)).isFalse();
    }

    @Test
    @DisplayName("Thiếu exp hoặc sig, hoặc đường dẫn không phải /uploads/<thư mục>/<tệp> -> không hợp lệ")
    void missingParts_orBadPaths_areRejected() {
        UploadUrlSigner signer = signerAt(NOW, "a-long-test-secret-for-signing");
        String signed = signer.sign(PATH);
        long exp = Long.parseLong(queryValue(signed, "exp"));
        String sig = queryValue(signed, "sig");

        assertThat(signer.verify(PATH, null, sig)).isFalse();
        assertThat(signer.verify(PATH, exp, null)).isFalse();
        assertThat(signer.verify(PATH, exp, "")).isFalse();
        for (String bad : new String[]{"/uploads/../etc/passwd", "/uploads/handover/../../x.jpg", "/uploads/handover/", "/uploads//x.jpg",
                "/other/handover/x.jpg", "uploads/handover/x.jpg", "/uploads/handover/.hidden", "http://evil.example/uploads/handover/x.jpg"}) {
            assertThat(UploadUrlSigner.isUploadPath(bad)).as(bad).isFalse();
            assertThat(signer.verify(bad, exp, signer.signature(bad, exp))).as(bad).isFalse();
        }
    }

    @Test
    @DisplayName("normalizePath bỏ phần query/fragment của link đã ký và từ chối mọi thứ không phải tệp tải lên")
    void normalizePath_stripsQueryAndRejectsForeignUrls() {
        assertThat(UploadUrlSigner.normalizePath(PATH + "?exp=1&sig=abc")).isEqualTo(PATH);
        assertThat(UploadUrlSigner.normalizePath("  " + PATH + "#frag ")).isEqualTo(PATH);
        assertThat(UploadUrlSigner.normalizePath(PATH)).isEqualTo(PATH);
        assertThat(UploadUrlSigner.normalizePath("http://evil.example/a.jpg")).isNull();
        assertThat(UploadUrlSigner.normalizePath("javascript:alert(1)")).isNull();
        assertThat(UploadUrlSigner.normalizePath("data:image/png;base64,AAAA")).isNull();
        assertThat(UploadUrlSigner.normalizePath(null)).isNull();
    }

    @Test
    @DisplayName("Thiếu khóa ký thì không khởi tạo được")
    void blankSecret_isRefused() {
        assertThrows(IllegalStateException.class, () -> new UploadUrlSigner(" ", 900, Clock.systemUTC()));
    }

    @Test
    @DisplayName("Thời hạn tối thiểu 30 giây")
    void ttlHasAFloor() {
        assertThat(new UploadUrlSigner("a-long-test-secret-for-signing", 1, Clock.systemUTC()).ttlSeconds()).isEqualTo(30);
    }
}
