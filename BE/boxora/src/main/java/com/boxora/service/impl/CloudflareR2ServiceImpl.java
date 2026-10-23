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
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class CloudflareR2ServiceImpl implements CloudflareR2Service {

    @Value("${app.r2.bucket-name:boxora-storage-units}")
    private String bucketName;

    @Value("${app.r2.public-url:https://pub-e15c7d96a163417fa2a23d5b849ee035.r2.dev}")
    private String publicUrlBase;

    private static final long MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "webp", "gif", "svg", "pdf"
    );

    @Override
    public FileUploadResponse uploadUnitImage(MultipartFile file) {
        return uploadFile(file, "units");
    }

    @Override
    public FileUploadResponse uploadFacilityImage(MultipartFile file) {
        return uploadFile(file, "facilities");
    }

    @Override
    public FileUploadResponse uploadFile(MultipartFile file, String folder) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Tệp tải lên không được để trống");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            log.warn("File size {} exceeds maximum 15MB limit for Cloudflare R2", file.getSize());
            throw new AppException(ErrorCode.TICKET_IMAGE_SIZE_EXCEEDED, "Kích thước ảnh vượt quá giới hạn 15MB");
        }

        String originalFilename = StringUtils.cleanPath(Objects.requireNonNullElse(file.getOriginalFilename(), "image.jpg"));
        String extension = getFileExtension(originalFilename).toLowerCase();

        if (!ALLOWED_IMAGE_EXTENSIONS.contains(extension)) {
            log.warn("Invalid file extension: {}. Only image formats allowed on Cloudflare R2.", extension);
            throw new AppException(ErrorCode.TICKET_INVALID_IMAGE_FORMAT, "Định dạng tệp không hợp lệ. Chỉ chấp nhận JPG, PNG, WEBP, GIF, SVG");
        }

        String safeFolder = sanitizeFolder(folder, "units");
        String uniqueFileName = String.format("unit-%s-%d.%s",
                UUID.randomUUID().toString().substring(0, 8),
                System.currentTimeMillis(),
                extension);
        String r2Key = safeFolder + "/" + uniqueFileName;

        Path tempFile = null;
        try {
            tempFile = Files.createTempFile("boxora-r2-", "." + extension);
            Files.copy(file.getInputStream(), tempFile, StandardCopyOption.REPLACE_EXISTING);

            log.info("Executing Cloudflare R2 remote upload for key: {} to bucket: {}", r2Key, bucketName);
            boolean uploadSuccess = executeWranglerR2Upload(bucketName, r2Key, tempFile.toFile());

            if (!uploadSuccess) {
                log.error("Failed to upload object {} to Cloudflare R2 bucket {}", r2Key, bucketName);
                throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Không thể tải ảnh lên kho lưu trữ đám mây Cloudflare R2");
            }

            String publicCdnUrl = normalizePublicUrl(publicUrlBase) + "/" + r2Key;
            log.info("Successfully uploaded image to Cloudflare R2 -> Public CDN URL: {}", publicCdnUrl);

            return FileUploadResponse.builder()
                    .fileName(uniqueFileName)
                    .fileUrl(publicCdnUrl)
                    .fileType(file.getContentType() != null ? file.getContentType() : "image/" + extension)
                    .fileSize(file.getSize())
                    .uploadedAt(LocalDateTime.now())
                    .build();

        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("Unexpected error during Cloudflare R2 upload: {}", e.getMessage(), e);
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Lỗi trong quá trình đẩy ảnh lên Cloudflare R2: " + e.getMessage());
        } finally {
            if (tempFile != null) {
                try {
                    Files.deleteIfExists(tempFile);
                } catch (Exception ignored) {
                }
            }
        }
    }

    private boolean executeWranglerR2Upload(String bucket, String key, File file) {
        try {
            boolean isWindows = System.getProperty("os.name", "").toLowerCase().contains("win");
            List<String> command = new ArrayList<>();

            if (isWindows) {
                command.add("cmd.exe");
                command.add("/c");
                command.add(String.format("npx -y wrangler r2 object put \"%s/%s\" --file=\"%s\" --remote",
                        bucket, key, file.getAbsolutePath().replace('\\', '/')));
            } else {
                command.add("npx");
                command.add("-y");
                command.add("wrangler");
                command.add("r2");
                command.add("object");
                command.add("put");
                command.add(bucket + "/" + key);
                command.add("--file=" + file.getAbsolutePath());
                command.add("--remote");
            }

            ProcessBuilder pb = new ProcessBuilder(command);
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
        return folder.replaceAll("[^a-zA-Z0-9_-]", "");
    }

    private String normalizePublicUrl(String url) {
        if (url == null || url.isBlank()) {
            return "https://pub-e15c7d96a163417fa2a23d5b849ee035.r2.dev";
        }
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
