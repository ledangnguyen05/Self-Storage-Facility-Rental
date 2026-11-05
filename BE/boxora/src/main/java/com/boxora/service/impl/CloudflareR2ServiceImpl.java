package com.boxora.service.impl;

import com.boxora.dto.response.FileUploadResponse;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.service.CloudflareR2Service;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class CloudflareR2ServiceImpl implements CloudflareR2Service {

    @Value("${app.r2.enabled:true}")
    private boolean r2Enabled;

    @Value("${app.r2.account-id:0e057a93c13437ab7a9f464e23cd9b48}")
    private String accountId;

    @Value("${app.r2.bucket-name:boxora-storage-units}")
    private String bucketName;

    @Value("${app.r2.public-url:https://pub-e15c7d96a163417fa2a23d5b849ee035.r2.dev}")
    private String publicUrlBase;

    @Value("${app.upload.dir:uploads}")
    private String localUploadDir;

    private static final long MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
    private static final Set<String> ALLOWED_STRICT_IMAGE_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "webp", "gif"
    );
    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "webp", "gif", "pdf"
    );
    private static final Set<String> ALLOWED_STRICT_IMAGE_MIME_TYPES = Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "application/octet-stream"
    );
    private static final Set<String> ALLOWED_UPLOAD_MIME_TYPES = Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "application/pdf", "application/octet-stream"
    );

    @Override
    public FileUploadResponse uploadUnitImage(MultipartFile file) {
        validateStrictImageFile(file);
        return uploadFile(file, "units");
    }

    @Override
    public FileUploadResponse uploadFacilityImage(MultipartFile file) {
        validateStrictImageFile(file);
        return uploadFile(file, "facilities");
    }

    private void validateStrictImageFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Tệp ảnh tải lên không được để trống");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new AppException(ErrorCode.TICKET_IMAGE_SIZE_EXCEEDED, "Kích thước ảnh vượt quá giới hạn 15MB");
        }
        String originalFilename = StringUtils.cleanPath(Objects.requireNonNullElse(file.getOriginalFilename(), ""));
        if (originalFilename.isBlank() || originalFilename.contains("..") || !originalFilename.contains(".")) {
            throw new AppException(ErrorCode.TICKET_INVALID_IMAGE_FORMAT, "Tên tệp ảnh không hợp lệ");
        }
        String extension = getFileExtension(originalFilename).toLowerCase(Locale.ROOT);
        if (!ALLOWED_STRICT_IMAGE_EXTENSIONS.contains(extension)) {
            throw new AppException(ErrorCode.TICKET_INVALID_IMAGE_FORMAT,
                    "Định dạng ảnh không hợp lệ. Chỉ chấp nhận JPG, JPEG, PNG, WEBP, GIF");
        }
        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank()) {
            String normalizedMime = contentType.split(";")[0].trim().toLowerCase(Locale.ROOT);
            if (!ALLOWED_STRICT_IMAGE_MIME_TYPES.contains(normalizedMime)) {
                throw new AppException(ErrorCode.TICKET_INVALID_IMAGE_FORMAT,
                        "Loại nội dung tệp (MIME type) không hợp lệ. Chỉ chấp nhận ảnh JPG, PNG, WEBP, GIF");
            }
        }
        try (var is = file.getInputStream()) {
            byte[] headerBytes = is.readNBytes(12);
            if (!isValidMagicBytes(extension, headerBytes)) {
                throw new AppException(ErrorCode.TICKET_INVALID_IMAGE_FORMAT,
                        "Nội dung tệp ảnh không hợp lệ hoặc bị đổi phần mở rộng giả mạo");
            }
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException(ErrorCode.TICKET_INVALID_IMAGE_FORMAT, "Không thể đọc dữ liệu tệp ảnh tải lên");
        }
    }

    @Override
    public FileUploadResponse uploadFile(MultipartFile file, String folder) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Tệp tải lên không được để trống");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            log.warn("File size {} exceeds maximum 15MB limit", file.getSize());
            throw new AppException(ErrorCode.TICKET_IMAGE_SIZE_EXCEEDED, "Kích thước ảnh vượt quá giới hạn 15MB");
        }

        String originalFilename = StringUtils.cleanPath(Objects.requireNonNullElse(file.getOriginalFilename(), "image.jpg"));
        if (originalFilename.contains("..")) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Tên tệp tải lên không hợp lệ");
        }
        String extension = getFileExtension(originalFilename).toLowerCase(Locale.ROOT);

        if (!ALLOWED_IMAGE_EXTENSIONS.contains(extension)) {
            log.warn("Invalid file extension: {}. Only image/PDF formats allowed.", extension);
            throw new AppException(ErrorCode.TICKET_INVALID_IMAGE_FORMAT, "Định dạng tệp không hợp lệ. Chỉ chấp nhận JPG, PNG, WEBP, GIF, PDF");
        }

        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank()) {
            String normalizedMime = contentType.split(";")[0].trim().toLowerCase(Locale.ROOT);
            if (!ALLOWED_UPLOAD_MIME_TYPES.contains(normalizedMime)) {
                throw new AppException(ErrorCode.TICKET_INVALID_IMAGE_FORMAT,
                        "Loại nội dung tệp (MIME type) không được phép tải lên");
            }
        }

        try (var is = file.getInputStream()) {
            byte[] headerBytes = is.readNBytes(12);
            if (!isValidMagicBytes(extension, headerBytes)) {
                throw new AppException(ErrorCode.TICKET_INVALID_IMAGE_FORMAT,
                        "Nội dung tệp không hợp lệ hoặc không khớp định dạng " + extension.toUpperCase(Locale.ROOT));
            }
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException(ErrorCode.TICKET_INVALID_IMAGE_FORMAT, "Không thể kiểm tra nội dung tệp tải lên");
        }

        String safeFolder = sanitizeFolder(folder, "units");
        String uniqueFileName = String.format("evidence-%s-%d.%s",
                UUID.randomUUID().toString().substring(0, 8),
                System.currentTimeMillis(),
                extension);
        String r2Key = safeFolder + "/" + uniqueFileName;

        Path tempFile = null;
        try {
            tempFile = Files.createTempFile("boxora-r2-", "." + extension);
            Files.copy(file.getInputStream(), tempFile, StandardCopyOption.REPLACE_EXISTING);

            String resolvedContentType = resolveMimeType(file.getContentType(), extension);
            boolean uploadSuccess = executeWranglerR2Upload(bucketName, r2Key, tempFile.toFile(), resolvedContentType);

            if (uploadSuccess) {
                String publicCdnUrl = normalizePublicUrl(publicUrlBase) + "/" + r2Key;
                log.info("Successfully uploaded image to Cloudflare R2 -> Public CDN URL: {}", publicCdnUrl);

                return FileUploadResponse.builder()
                        .fileName(uniqueFileName)
                        .fileUrl(publicCdnUrl)
                        .fileType(resolvedContentType)
                        .fileSize(file.getSize())
                        .uploadedAt(LocalDateTime.now())
                        .build();
            } else {
                log.info("Cloudflare R2 remote upload skipped or unavailable for key: {}. Falling back to local storage.", r2Key);
                Path localDir = Paths.get(localUploadDir, safeFolder).toAbsolutePath().normalize();
                Files.createDirectories(localDir);
                Path localTarget = localDir.resolve(uniqueFileName);
                Files.copy(tempFile, localTarget, StandardCopyOption.REPLACE_EXISTING);
                String localUrl = "/uploads/" + safeFolder + "/" + uniqueFileName;
                log.info("Saved uploaded file locally at {} -> URL: {}", localTarget, localUrl);

                return FileUploadResponse.builder()
                        .fileName(uniqueFileName)
                        .fileUrl(localUrl)
                        .fileType(file.getContentType() != null ? file.getContentType() : "image/" + extension)
                        .fileSize(file.getSize())
                        .uploadedAt(LocalDateTime.now())
                        .build();
            }

        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("Unexpected error during file upload: {}", e.getMessage(), e);
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Lỗi trong quá trình xử lý tệp: " + e.getMessage());
        } finally {
            if (tempFile != null) {
                try {
                    Files.deleteIfExists(tempFile);
                } catch (Exception ignored) {
                }
            }
        }
    }

    private String resolveMimeType(String rawContentType, String extension) {
        if (rawContentType != null && !rawContentType.isBlank() && !rawContentType.equalsIgnoreCase("application/octet-stream")) {
            return rawContentType.split(";")[0].trim();
        }
        return switch (extension.toLowerCase(Locale.ROOT)) {
            case "pdf" -> "application/pdf";
            case "png" -> "image/png";
            case "webp" -> "image/webp";
            case "gif" -> "image/gif";
            case "svg" -> "image/svg+xml";
            default -> "image/jpeg";
        };
    }

    private boolean executeWranglerR2Upload(String bucket, String key, File file, String contentType) {
        if (!r2Enabled) {
            return false;
        }
        try {
            boolean isWindows = System.getProperty("os.name", "").toLowerCase().contains("win");
            List<String> command = new ArrayList<>();
            String safeContentType = (contentType != null && !contentType.isBlank()) ? contentType : "image/jpeg";

            if (isWindows) {
                command.add("cmd.exe");
                command.add("/c");
                command.add(String.format("npx --yes wrangler r2 object put \"%s/%s\" --file=\"%s\" --content-type=\"%s\" --remote",
                        bucket, key, file.getAbsolutePath().replace('\\', '/'), safeContentType));
            } else {
                command.add("npx");
                command.add("--yes");
                command.add("wrangler");
                command.add("r2");
                command.add("object");
                command.add("put");
                command.add(bucket + "/" + key);
                command.add("--file=" + file.getAbsolutePath());
                command.add("--content-type=" + safeContentType);
                command.add("--remote");
            }

            ProcessBuilder pb = new ProcessBuilder(command);
            if (accountId != null && !accountId.isBlank()) {
                pb.environment().putIfAbsent("CLOUDFLARE_ACCOUNT_ID", accountId.trim());
            }
            pb.redirectErrorStream(true);
            Process process = pb.start();

            StringBuilder outputLog = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    outputLog.append(line).append(System.lineSeparator());
                }
            }

            boolean finished = process.waitFor(45, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                log.error("Wrangler R2 upload timed out after 45s: {}", outputLog);
                return false;
            }

            int exitCode = process.exitValue();
            if (exitCode != 0) {
                log.error("Wrangler R2 upload exited with code {}: {}", exitCode, outputLog);
                return false;
            }

            return true;
        } catch (Exception ex) {
            log.error("Exception while executing wrangler R2 upload process: {}", ex.getMessage(), ex);
            return false;
        }
    }

    private String getFileExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "jpg";
        }
        return filename.substring(filename.lastIndexOf(".") + 1);
    }

    private String sanitizeFolder(String folder, String defaultFolder) {
        if (folder == null || folder.isBlank()) {
            return defaultFolder;
        }
        String cleaned = folder.trim().replace('\\', '/').replaceAll("[^a-zA-Z0-9_/-]", "").replaceAll("//+", "/");
        while (cleaned.startsWith("/")) {
            cleaned = cleaned.substring(1);
        }
        while (cleaned.endsWith("/")) {
            cleaned = cleaned.substring(0, cleaned.length() - 1);
        }
        return cleaned.isBlank() ? defaultFolder : cleaned;
    }

    private String normalizePublicUrl(String url) {
        if (url == null || url.isBlank()) {
            return "https://pub-e15c7d96a163417fa2a23d5b849ee035.r2.dev";
        }
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    private boolean isValidMagicBytes(String extension, byte[] header) {
        if (header == null || header.length < 3) {
            return false;
        }
        return switch (extension.toLowerCase(Locale.ROOT)) {
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
            case "gif" -> header.length >= 6
                    && header[0] == 'G'
                    && header[1] == 'I'
                    && header[2] == 'F'
                    && header[3] == '8'
                    && (header[4] == '7' || header[4] == '9')
                    && header[5] == 'a';
            default -> false;
        };
    }
}
