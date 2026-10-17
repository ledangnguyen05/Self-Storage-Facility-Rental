package com.boxora.service.impl;

import com.boxora.dto.response.FileUploadResponse;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.service.FileStorageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.*;

@Service
@Slf4j
public class FileStorageServiceImpl implements FileStorageService {

    private final Path rootUploadPath;
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "webp", "gif"
    );
    private static final Set<String> ALLOWED_DOCUMENT_EXTENSIONS = Set.of(
            "pdf", "jpg", "jpeg", "png", "webp"
    );
    private static final Set<String> ALLOWED_DOCUMENT_MIME_TYPES = Set.of(
            "application/pdf",
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
            "application/octet-stream"
    );

    public FileStorageServiceImpl(@Value("${app.upload.dir:uploads}") String uploadDir) {
        this.rootUploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.rootUploadPath);
        } catch (IOException e) {
            log.error("Failed to initialize upload root directory at {}", this.rootUploadPath, e);
            throw new AppException(ErrorCode.TICKET_IMAGE_UPLOAD_FAILED);
        }
    }

    @Override
    public FileUploadResponse storeFile(MultipartFile file, String subDirectory) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.TICKET_IMAGE_UPLOAD_FAILED);
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            log.warn("File size {} exceeds maximum 10MB limit", file.getSize());
            throw new AppException(ErrorCode.TICKET_IMAGE_SIZE_EXCEEDED);
        }

        String originalFilename = StringUtils.cleanPath(Objects.requireNonNullElse(file.getOriginalFilename(), "image.jpg"));
        String extension = getFileExtension(originalFilename);

        if (!ALLOWED_IMAGE_EXTENSIONS.contains(extension.toLowerCase())) {
            log.warn("Invalid file extension: {}. Only image formats allowed.", extension);
            throw new AppException(ErrorCode.TICKET_INVALID_IMAGE_FORMAT);
        }

        try {
            String safeSubDir = sanitizeSubDirectory(subDirectory, "general");
            Path targetDirectory = this.rootUploadPath.resolve(safeSubDir).normalize();
            if (!targetDirectory.startsWith(this.rootUploadPath)) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Đường dẫn thư mục tải lên không hợp lệ");
            }
            Files.createDirectories(targetDirectory);

            String storedFileName = String.format("evidence-%s-%d.%s",
                    UUID.randomUUID().toString().substring(0, 8),
                    System.currentTimeMillis(),
                    extension.toLowerCase());

            Path targetPath = targetDirectory.resolve(storedFileName);
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

            String fileUrl = "/uploads/" + safeSubDir.replace('\\', '/') + "/" + storedFileName;
            log.info("Stored uploaded image at {} -> URL: {}", targetPath, fileUrl);

            return FileUploadResponse.builder()
                    .fileName(storedFileName)
                    .fileUrl(fileUrl)
                    .fileType(file.getContentType() != null ? file.getContentType() : "image/" + extension)
                    .fileSize(file.getSize())
                    .uploadedAt(LocalDateTime.now())
                    .build();

        } catch (IOException e) {
            log.error("Could not store file {}", originalFilename, e);
            throw new AppException(ErrorCode.TICKET_IMAGE_UPLOAD_FAILED);
        }
    }

    @Override
    public List<FileUploadResponse> storeFiles(List<MultipartFile> files, String subDirectory) {
        if (files == null || files.isEmpty()) {
            return Collections.emptyList();
        }
        List<FileUploadResponse> responses = new ArrayList<>();
        for (MultipartFile file : files) {
            if (file != null && !file.isEmpty()) {
                responses.add(storeFile(file, subDirectory));
            }
        }
        return responses;
    }

    @Override
    public FileUploadResponse storeDocumentFile(MultipartFile file, String subDirectory) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Tệp tài liệu tải lên không được để trống");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            log.warn("Document file size {} exceeds maximum 10MB limit", file.getSize());
            throw new AppException(ErrorCode.TICKET_IMAGE_SIZE_EXCEEDED, "Kích thước tệp vượt quá giới hạn tối đa 10MB");
        }

        String rawFilename = Objects.requireNonNullElse(file.getOriginalFilename(), "");
        String originalFilename = StringUtils.cleanPath(rawFilename);
        if (originalFilename.isBlank() || originalFilename.contains("..")) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Tên tệp tải lên không hợp lệ");
        }

        String extension = getStrictFileExtension(originalFilename).toLowerCase(Locale.ROOT);
        if (!ALLOWED_DOCUMENT_EXTENSIONS.contains(extension)) {
            log.warn("Invalid document extension: {}. Allowed: PDF, JPG, JPEG, PNG, WEBP", extension);
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Định dạng tệp không hợp lệ. Chỉ chấp nhận PDF, JPG, JPEG, PNG, WEBP");
        }

        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank()) {
            String normalizedMime = contentType.split(";")[0].trim().toLowerCase(Locale.ROOT);
            if (!ALLOWED_DOCUMENT_MIME_TYPES.contains(normalizedMime)) {
                log.warn("Invalid document MIME type: {} for file {}", normalizedMime, originalFilename);
                throw new AppException(ErrorCode.INVALID_REQUEST,
                        "Loại nội dung tệp (MIME type) không hợp lệ. Chỉ chấp nhận PDF hoặc hình ảnh JPG, PNG, WEBP");
            }
            if ("pdf".equals(extension) && normalizedMime.startsWith("image/")) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Tệp có phần mở rộng PDF nhưng MIME type là ảnh");
            }
            if (!"pdf".equals(extension) && "application/pdf".equals(normalizedMime)) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Tệp có phần mở rộng ảnh nhưng MIME type là PDF");
            }
        }

        try {
            byte[] headerBytes;
            try (var is = file.getInputStream()) {
                headerBytes = is.readNBytes(12);
            }
            if (!isValidMagicBytes(extension, headerBytes)) {
                log.warn("File magic bytes mismatch for extension {} on file {}", extension, originalFilename);
                throw new AppException(ErrorCode.INVALID_REQUEST,
                        "Nội dung tệp không hợp lệ hoặc bị giả mạo phần mở rộng (chữ ký tệp không khớp " + extension.toUpperCase(Locale.ROOT) + ")");
            }

            String safeSubDir = sanitizeSubDirectory(subDirectory, "handovers");
            Path targetDirectory = this.rootUploadPath.resolve(safeSubDir).normalize();
            if (!targetDirectory.startsWith(this.rootUploadPath)) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Đường dẫn lưu trữ tài liệu không hợp lệ");
            }
            Files.createDirectories(targetDirectory);

            String storedFileName = String.format("doc-%s-%d.%s",
                    UUID.randomUUID().toString().substring(0, 8),
                    System.currentTimeMillis(),
                    extension);

            Path targetPath = targetDirectory.resolve(storedFileName).normalize();
            if (!targetPath.startsWith(this.rootUploadPath)) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Đường dẫn tệp đích không hợp lệ");
            }

            try (var inputStream = file.getInputStream()) {
                Files.copy(inputStream, targetPath, StandardCopyOption.REPLACE_EXISTING);
            }

            String fileUrl = "/uploads/" + safeSubDir.replace('\\', '/') + "/" + storedFileName;
            if (fileUrl.length() > 500) {
                Files.deleteIfExists(targetPath);
                throw new AppException(ErrorCode.INVALID_REQUEST, "Đường dẫn tệp sinh ra vượt quá 500 ký tự");
            }

            String resolvedContentType = "pdf".equals(extension)
                    ? "application/pdf"
                    : ("jpg".equals(extension) ? "image/jpeg" : "image/" + extension);

            log.info("Stored document at {} -> URL: {}", targetPath, fileUrl);

            return FileUploadResponse.builder()
                    .fileName(storedFileName)
                    .fileUrl(fileUrl)
                    .fileType(resolvedContentType)
                    .fileSize(file.getSize())
                    .uploadedAt(LocalDateTime.now())
                    .build();

        } catch (AppException e) {
            throw e;
        } catch (IOException e) {
            log.error("Could not store document file {}", originalFilename, e);
            throw new AppException(ErrorCode.TICKET_IMAGE_UPLOAD_FAILED, "Không thể lưu trữ tệp tài liệu tải lên");
        }
    }

    @Override
    public void deleteFileIfExists(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank() || !fileUrl.startsWith("/uploads/")) {
            return;
        }
        try {
            Path targetPath = resolveStoredFilePath(fileUrl);
            if (targetPath != null && Files.exists(targetPath) && Files.isRegularFile(targetPath)) {
                Files.deleteIfExists(targetPath);
                log.info("Cleaned up stored file at {}", targetPath);
            }
        } catch (Exception e) {
            log.warn("Failed to delete file for URL {}: {}", fileUrl, e.getMessage());
        }
    }

    @Override
    public Path resolveStoredFilePath(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank() || !fileUrl.startsWith("/uploads/")) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Đường dẫn tệp lưu trữ không hợp lệ");
        }
        String relativePath = fileUrl.substring("/uploads/".length()).trim();
        if (relativePath.isBlank() || relativePath.contains("..")) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Đường dẫn tệp chứa ký tự truy cập trái phép");
        }
        Path resolved = this.rootUploadPath.resolve(relativePath).normalize();
        if (!resolved.startsWith(this.rootUploadPath)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Truy cập tệp ngoài phạm vi thư mục cho phép");
        }
        return resolved;
    }

    private String sanitizeSubDirectory(String subDirectory, String defaultDir) {
        if (subDirectory == null || subDirectory.isBlank()) {
            return defaultDir;
        }
        String cleaned = subDirectory.trim().replace('\\', '/');
        while (cleaned.startsWith("/")) {
            cleaned = cleaned.substring(1);
        }
        while (cleaned.endsWith("/")) {
            cleaned = cleaned.substring(0, cleaned.length() - 1);
        }
        if (cleaned.isBlank() || cleaned.contains("..")) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Thư mục lưu trữ không hợp lệ");
        }
        return cleaned;
    }

    private boolean isValidMagicBytes(String extension, byte[] header) {
        if (header == null || header.length < 4) {
            return false;
        }
        return switch (extension) {
            case "pdf" -> header.length >= 5
                    && header[0] == 0x25 // '%'
                    && header[1] == 0x50 // 'P'
                    && header[2] == 0x44 // 'D'
                    && header[3] == 0x46 // 'F'
                    && header[4] == 0x2D; // '-'
            case "jpg", "jpeg" -> header.length >= 3
                    && (header[0] & 0xFF) == 0xFF
                    && (header[1] & 0xFF) == 0xD8
                    && (header[2] & 0xFF) == 0xFF;
            case "png" -> header.length >= 8
                    && (header[0] & 0xFF) == 0x89
                    && header[1] == 0x50 // 'P'
                    && header[2] == 0x4E // 'N'
                    && header[3] == 0x47 // 'G'
                    && header[4] == 0x0D
                    && header[5] == 0x0A
                    && header[6] == 0x1A
                    && header[7] == 0x0A;
            case "webp" -> header.length >= 12
                    && header[0] == 'R'
                    && header[1] == 'I'
                    && header[2] == 'F'
                    && header[3] == 'F'
                    && header[8] == 'W'
                    && header[9] == 'E'
                    && header[10] == 'B'
                    && header[11] == 'P';
            default -> false;
        };
    }

    private String getStrictFileExtension(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex > 0 && dotIndex < filename.length() - 1) {
            return filename.substring(dotIndex + 1);
        }
        return "";
    }

    private String getFileExtension(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex > 0 && dotIndex < filename.length() - 1) {
            return filename.substring(dotIndex + 1);
        }
        return "jpg";
    }
}
