package com.boxora.service;

import com.boxora.dto.response.FileUploadResponse;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.service.impl.FileStorageServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class FileStorageServiceTest {

    @TempDir
    Path tempUploadDir;

    private FileStorageServiceImpl fileStorageService;

    @BeforeEach
    void setUp() {
        fileStorageService = new FileStorageServiceImpl(tempUploadDir.toString());
    }

    @Test
    @DisplayName("storeFile should save valid jpg image and return response with URL")
    void storeFile_validJpgImage_shouldSucceed() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "evidence_broken_lock.jpg",
                "image/jpeg",
                "fake-jpeg-binary-data".getBytes()
        );

        FileUploadResponse response = fileStorageService.storeFile(file, "tickets");

        assertThat(response).isNotNull();
        assertThat(response.getFileName()).startsWith("evidence-").endsWith(".jpg");
        assertThat(response.getFileUrl()).startsWith("/uploads/tickets/");
        assertThat(response.getFileSize()).isEqualTo(file.getSize());
    }

    @Test
    @DisplayName("storeFile should accept png, webp, and gif formats")
    void storeFile_otherAllowedFormats_shouldSucceed() {
        MockMultipartFile pngFile = new MockMultipartFile(
                "file", "photo.PNG", "image/png", "png-content".getBytes()
        );
        FileUploadResponse response = fileStorageService.storeFile(pngFile, "tickets");

        assertThat(response).isNotNull();
        assertThat(response.getFileName()).endsWith(".png");
    }

    @Test
    @DisplayName("storeFile should reject unsupported file extensions (e.g., .exe, .pdf, .sh)")
    void storeFile_unsupportedExtension_shouldThrowException() {
        MockMultipartFile invalidFile = new MockMultipartFile(
                "file", "script.sh", "text/plain", "echo hello".getBytes()
        );

        AppException ex = assertThrows(AppException.class, () ->
                fileStorageService.storeFile(invalidFile, "tickets"));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TICKET_INVALID_IMAGE_FORMAT);
    }

    @Test
    @DisplayName("storeFile should reject empty file")
    void storeFile_emptyFile_shouldThrowException() {
        MockMultipartFile emptyFile = new MockMultipartFile(
                "file", "empty.jpg", "image/jpeg", new byte[0]
        );

        AppException ex = assertThrows(AppException.class, () ->
                fileStorageService.storeFile(emptyFile, "tickets"));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TICKET_IMAGE_UPLOAD_FAILED);
    }

    @Test
    @DisplayName("storeFile should reject file exceeding 10MB limit")
    void storeFile_oversizedFile_shouldThrowException() {
        byte[] oversizedData = new byte[11 * 1024 * 1024]; // 11MB
        MockMultipartFile oversizedFile = new MockMultipartFile(
                "file", "huge.jpg", "image/jpeg", oversizedData
        );

        AppException ex = assertThrows(AppException.class, () ->
                fileStorageService.storeFile(oversizedFile, "tickets"));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TICKET_IMAGE_SIZE_EXCEEDED);
    }

    @Test
    @DisplayName("storeFiles should store multiple valid files and return list")
    void storeFiles_multipleValidFiles_shouldSucceed() {
        MockMultipartFile file1 = new MockMultipartFile("f1", "img1.jpg", "image/jpeg", "data1".getBytes());
        MockMultipartFile file2 = new MockMultipartFile("f2", "img2.png", "image/png", "data2".getBytes());

        List<FileUploadResponse> responses = fileStorageService.storeFiles(List.of(file1, file2), "tickets");

        assertThat(responses).hasSize(2);
        assertThat(responses.get(0).getFileUrl()).startsWith("/uploads/tickets/");
        assertThat(responses.get(1).getFileUrl()).startsWith("/uploads/tickets/");
    }

    private static byte[] withHeader(byte[] header) {
        byte[] data = new byte[64];
        System.arraycopy(header, 0, data, 0, header.length);
        return data;
    }

    @Test
    @DisplayName("storeDocument accepts a real PDF and an image, names them with an unguessable UUID")
    void storeDocument_pdfAndImage_shouldSucceed() {
        MockMultipartFile pdf = new MockMultipartFile("file", "hop-dong.pdf", "application/pdf", withHeader("%PDF-1.7".getBytes()));
        MockMultipartFile jpg = new MockMultipartFile("file", "bien-lai.JPG", "image/jpeg",
                withHeader(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0}));

        FileUploadResponse pdfResponse = fileStorageService.storeDocument(pdf, "handover");
        FileUploadResponse jpgResponse = fileStorageService.storeDocument(jpg, "handover");

        assertThat(pdfResponse.getFileUrl()).matches("^/uploads/handover/[0-9a-f-]{36}\\.pdf$");
        assertThat(pdfResponse.getFileType()).isEqualTo("application/pdf");
        assertThat(jpgResponse.getFileUrl()).matches("^/uploads/handover/[0-9a-f-]{36}\\.jpg$");
        assertThat(tempUploadDir.resolve("handover").toFile().list()).hasSize(2);
    }

    @Test
    @DisplayName("storeDocument rejects content that does not match its extension, scripts and html")
    void storeDocument_wrongContent_shouldThrow() {
        MockMultipartFile fakePdf = new MockMultipartFile("file", "x.pdf", "application/pdf", withHeader("<html><script>".getBytes()));
        MockMultipartFile script = new MockMultipartFile("file", "x.sh", "text/plain", withHeader("echo".getBytes()));
        MockMultipartFile mismatch = new MockMultipartFile("file", "x.png", "application/pdf", withHeader("%PDF-1.7".getBytes()));

        assertThat(assertThrows(AppException.class, () -> fileStorageService.storeDocument(fakePdf, "handover")).getErrorCode())
                .isEqualTo(ErrorCode.FILE_FORMAT_NOT_ALLOWED);
        assertThat(assertThrows(AppException.class, () -> fileStorageService.storeDocument(script, "handover")).getErrorCode())
                .isEqualTo(ErrorCode.FILE_FORMAT_NOT_ALLOWED);
        assertThat(assertThrows(AppException.class, () -> fileStorageService.storeDocument(mismatch, "handover")).getErrorCode())
                .isEqualTo(ErrorCode.FILE_FORMAT_NOT_ALLOWED);
    }

    @Test
    @DisplayName("storeDocument: empty file and 11MB file get their own errors")
    void storeDocument_emptyAndOversized() {
        MockMultipartFile empty = new MockMultipartFile("file", "x.pdf", "application/pdf", new byte[0]);
        MockMultipartFile huge = new MockMultipartFile("file", "x.pdf", "application/pdf", new byte[11 * 1024 * 1024]);

        assertThat(assertThrows(AppException.class, () -> fileStorageService.storeDocument(empty, "handover")).getErrorCode())
                .isEqualTo(ErrorCode.FILE_UPLOAD_EMPTY);
        assertThat(assertThrows(AppException.class, () -> fileStorageService.storeDocument(huge, "handover")).getErrorCode())
                .isEqualTo(ErrorCode.FILE_TOO_LARGE);
    }

    @Test
    @DisplayName("A sub directory that tries to leave the upload root falls back to 'general'")
    void storeDocument_pathTraversalSubDirectory_isNeutralised() {
        MockMultipartFile png = new MockMultipartFile("file", "a.png", "image/png",
                withHeader(new byte[]{(byte) 0x89, 'P', 'N', 'G'}));

        FileUploadResponse response = fileStorageService.storeDocument(png, "../../etc");

        assertThat(response.getFileUrl()).startsWith("/uploads/general/");
        assertThat(tempUploadDir.getParent().resolve("etc")).doesNotExist();
    }
}
