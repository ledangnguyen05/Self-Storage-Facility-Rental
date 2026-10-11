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
}

