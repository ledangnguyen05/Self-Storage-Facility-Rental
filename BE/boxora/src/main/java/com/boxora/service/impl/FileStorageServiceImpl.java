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
            String safeSubDir = (subDirectory != null && !subDirectory.isBlank()) ? subDirectory.trim() : "general";
            Path targetDirectory = this.rootUploadPath.resolve(safeSubDir).normalize();
            Files.createDirectories(targetDirectory);

            String storedFileName = String.format("evidence-%s-%d.%s",
                    UUID.randomUUID().toString().substring(0, 8),
                    System.currentTimeMillis(),
                    extension.toLowerCase());

            Path targetPath = targetDirectory.resolve(storedFileName);
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

            String fileUrl = "/uploads/" + safeSubDir + "/" + storedFileName;
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

    private String getFileExtension(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex > 0 && dotIndex < filename.length() - 1) {
            return filename.substring(dotIndex + 1);
        }
        return "jpg";
    }
}

