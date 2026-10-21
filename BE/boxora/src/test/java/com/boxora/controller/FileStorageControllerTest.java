package com.boxora.controller;

import com.boxora.exception.GlobalExceptionHandler;
import com.boxora.service.impl.FileStorageAccessService;
import com.boxora.service.impl.FileStorageServiceImpl;
import com.boxora.service.impl.UploadUrlSigner;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** GET /uploads/** answers only for a valid, unexpired signature. No bearer token is involved. */
class FileStorageControllerTest {

    private static final String PATH = "/uploads/handover/9f1c2d3e-0000-4000-8000-000000000001.jpg";
    private static final byte[] BYTES = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 1, 2, 3};

    @TempDir
    Path uploadRoot;

    private UploadUrlSigner signer;
    private MockMvc mvc;

    @BeforeEach
    void setUp() throws Exception {
        Path dir = Files.createDirectories(uploadRoot.resolve("handover"));
        Files.write(dir.resolve("9f1c2d3e-0000-4000-8000-000000000001.jpg"), BYTES);
        signer = new UploadUrlSigner("a-long-test-secret-for-signing", 900, Clock.systemUTC());
        FileStorageController controller = new FileStorageController(
                mock(FileStorageAccessService.class), new FileStorageServiceImpl(uploadRoot.toString()), signer);
        mvc = MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    private String query(String signedUrl) {
        return signedUrl.substring(signedUrl.indexOf('?'));
    }

    @Test
    @DisplayName("Link ký số hợp lệ: 200, đúng loại tệp, không cho đoán kiểu nội dung, cache riêng tư")
    void validSignedLink_servesTheFile() throws Exception {
        byte[] body = mvc.perform(get(PATH + query(signer.sign(PATH))))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/jpeg"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Content-Disposition", "inline"))
                .andReturn().getResponse().getContentAsByteArray();
        assertArrayEquals(BYTES, body);
    }

    @Test
    @DisplayName("Không có chữ ký: 403 FILE_LINK_INVALID, không trả nội dung tệp")
    void missingSignature_isForbidden() throws Exception {
        mvc.perform(get(PATH))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(2215));
        mvc.perform(get(PATH + "?exp=" + (Instant.now().getEpochSecond() + 600)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Chữ ký sai, của tệp khác, hết hạn hoặc exp không phải số: 403")
    void tamperedOrExpiredSignature_isForbidden() throws Exception {
        String signed = signer.sign(PATH);
        mvc.perform(get(PATH + query(signed).replace("sig=", "sig=x"))).andExpect(status().isForbidden());

        String otherFile = "/uploads/handover/other-file.jpg";
        mvc.perform(get(PATH + query(signer.sign(otherFile)))).andExpect(status().isForbidden());

        long past = Instant.now().getEpochSecond() - 10;
        mvc.perform(get(PATH + "?exp=" + past + "&sig=" + signer.signature(PATH, past))).andExpect(status().isForbidden());
        mvc.perform(get(PATH + "?exp=abc&sig=whatever")).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Chữ ký đúng nhưng tệp đã bị xóa: 404")
    void signedLinkToAMissingFile_isNotFound() throws Exception {
        String gone = "/uploads/handover/deleted.jpg";
        mvc.perform(get(gone + query(signer.sign(gone))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(2216));
    }

    @Test
    @DisplayName("Đường dẫn thoát khỏi thư mục tải lên không bao giờ được phục vụ, kể cả khi có chữ ký")
    void traversalIsNeverServed() throws Exception {
        Files.write(uploadRoot.resolve("secret.txt"), "secret".getBytes());
        String bad = "/uploads/handover/..";
        mvc.perform(get("/uploads/handover/..?exp=" + (Instant.now().getEpochSecond() + 600) + "&sig=" + signer.signature(bad, Instant.now().getEpochSecond() + 600)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Link đã ký trước thời điểm hiện tại 15 phút vẫn dùng được đến phút cuối")
    void linkIsUsableUntilItsExpiry() throws Exception {
        UploadUrlSigner shortLived = new UploadUrlSigner("a-long-test-secret-for-signing", 900,
                Clock.fixed(Instant.now().minusSeconds(800), ZoneOffset.UTC));
        mvc.perform(get(PATH + query(shortLived.sign(PATH)))).andExpect(status().isOk());
    }
}
