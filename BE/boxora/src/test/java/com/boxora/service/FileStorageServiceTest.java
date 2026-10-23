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

    @Test
    @DisplayName("storeDocumentFile should store valid PDF with magic bytes %PDF-")
    void storeDocumentFile_validPdf_shouldSucceed() {
        byte[] pdfBytes = "%PDF-1.4 sample pdf content".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        MockMultipartFile pdfFile = new MockMultipartFile(
                "file", "contract.pdf", "application/pdf", pdfBytes
        );

        FileUploadResponse response = fileStorageService.storeDocumentFile(pdfFile, "contracts/b1");
        assertThat(response).isNotNull();
        assertThat(response.getFileUrl()).startsWith("/uploads/contracts/b1/").endsWith(".pdf");
        assertThat(fileStorageService.resolveStoredFilePath(response.getFileUrl())).exists();
    }

    @Test
    @DisplayName("storeDocumentFile should store valid JPEG with magic bytes FF D8 FF")
    void storeDocumentFile_validJpg_shouldSucceed() {
        byte[] jpgBytes = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0x00, 0x10, 0x4A, 0x46};
        MockMultipartFile jpgFile = new MockMultipartFile(
                "file", "proof.jpg", "image/jpeg", jpgBytes
        );

        FileUploadResponse response = fileStorageService.storeDocumentFile(jpgFile, "payments/b1");
        assertThat(response).isNotNull();
        assertThat(response.getFileUrl()).startsWith("/uploads/payments/b1/").endsWith(".jpg");
    }

    @Test
    @DisplayName("storeDocumentFile should store valid PNG with magic bytes 89 50 4E 47")
    void storeDocumentFile_validPng_shouldSucceed() {
        byte[] pngBytes = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
        MockMultipartFile pngFile = new MockMultipartFile(
                "file", "proof.png", "image/png", pngBytes
        );

        FileUploadResponse response = fileStorageService.storeDocumentFile(pngFile, "payments/b1");
        assertThat(response).isNotNull();
        assertThat(response.getFileUrl()).startsWith("/uploads/payments/b1/").endsWith(".png");
    }

    @Test
    @DisplayName("storeDocumentFile should store valid WEBP with magic bytes RIFF...WEBP")
    void storeDocumentFile_validWebp_shouldSucceed() {
        byte[] webpBytes = "RIFF\0\0\0\0WEBPVP8 ".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        MockMultipartFile webpFile = new MockMultipartFile(
                "file", "proof.webp", "image/webp", webpBytes
        );

        FileUploadResponse response = fileStorageService.storeDocumentFile(webpFile, "payments/b1");
        assertThat(response).isNotNull();
        assertThat(response.getFileUrl()).startsWith("/uploads/payments/b1/").endsWith(".webp");
    }

    @Test
    @DisplayName("storeDocumentFile should reject file with spoofed extension and wrong magic bytes")
    void storeDocumentFile_mismatchedMagicBytes_shouldThrowException() {
        MockMultipartFile fakePdf = new MockMultipartFile(
                "file", "malicious.pdf", "application/pdf", "not a pdf header".getBytes()
        );

        AppException ex = assertThrows(AppException.class, () ->
                fileStorageService.storeDocumentFile(fakePdf, "contracts/b1"));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
    }

    @Test
    @DisplayName("storeDocumentFile should reject unsupported document extensions (e.g. .exe, .sh)")
    void storeDocumentFile_unsupportedExtension_shouldThrowException() {
        MockMultipartFile exeFile = new MockMultipartFile(
                "file", "malicious.exe", "application/octet-stream", "MZ\0\0".getBytes()
        );

        AppException ex = assertThrows(AppException.class, () ->
                fileStorageService.storeDocumentFile(exeFile, "contracts/b1"));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
    }

    @Test
    @DisplayName("storeDocumentFile should reject path traversal in subDir")
    void storeDocumentFile_pathTraversal_shouldThrowException() {
        byte[] pdfBytes = "%PDF-1.4 test".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        MockMultipartFile pdfFile = new MockMultipartFile(
                "file", "contract.pdf", "application/pdf", pdfBytes
        );

        AppException ex = assertThrows(AppException.class, () ->
                fileStorageService.storeDocumentFile(pdfFile, "../../etc/passwd"));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
    }

    @Test
    @DisplayName("deleteFileIfExists should safely delete file and resolveStoredFilePath should reject traversal")
    void deleteAndResolve_pathTraversal_protection() {
        byte[] pdfBytes = "%PDF-1.4 delete test".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        MockMultipartFile pdfFile = new MockMultipartFile(
                "file", "contract.pdf", "application/pdf", pdfBytes
        );
        FileUploadResponse response = fileStorageService.storeDocumentFile(pdfFile, "contracts/b2");
        assertThat(fileStorageService.resolveStoredFilePath(response.getFileUrl())).exists();

        fileStorageService.deleteFileIfExists(response.getFileUrl());
        assertThat(fileStorageService.resolveStoredFilePath(response.getFileUrl())).doesNotExist();

        assertThrows(AppException.class, () ->
                fileStorageService.resolveStoredFilePath("/uploads/../../etc/passwd"));
    }
}
