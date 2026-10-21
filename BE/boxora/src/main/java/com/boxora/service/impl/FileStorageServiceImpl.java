package com.boxora.service.impl;

import com.boxora.dto.response.FileUploadResponse;
import com.boxora.entity.StoredFile;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.StoredFileRepository;
import com.boxora.security.RequestContext;
import com.boxora.service.FileStorageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
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
import java.util.regex.Pattern;

@Service
@Slf4j
public class FileStorageServiceImpl implements FileStorageService {

    private final Path rootUploadPath;
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "webp", "gif"
    );
    /** Photos and scans staff attach to handovers and payments. */
    private static final Set<String> ALLOWED_DOCUMENT_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "webp", "pdf"
    );
    private static final Pattern SAFE_SUB_DIRECTORY = Pattern.compile("^[A-Za-z0-9_-]{1,40}$");

    private final StoredFileRepository storedFileRepository;
    private final RequestContext requestContext;

    /** Without a registry (plain unit tests) files are stored but not registered, so signed links and ownership checks are off. */
    public FileStorageServiceImpl(String uploadDir) {
        this(uploadDir, null, null);
    }

    @Autowired
    public FileStorageServiceImpl(@Value("${app.upload.dir:uploads}") String uploadDir,
                                  StoredFileRepository storedFileRepository,
                                  RequestContext requestContext) {
        this.storedFileRepository = storedFileRepository;
        this.requestContext = requestContext;
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
            String safeSubDir = sanitizeSubDirectory(subDirectory);
            Path targetDirectory = this.rootUploadPath.resolve(safeSubDir).normalize();
            Files.createDirectories(targetDirectory);

            // The name is a full random UUID; the file is only served through a short-lived signed link anyway.
            String storedFileName = String.format("evidence-%s.%s", UUID.randomUUID(), extension.toLowerCase());

            Path targetPath = targetDirectory.resolve(storedFileName);
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

            String fileUrl = "/uploads/" + safeSubDir + "/" + storedFileName;
            log.info("Stored uploaded image at {} -> URL: {}", targetPath, fileUrl);
            register(fileUrl, safeSubDir, originalFilename, file.getContentType(), file.getSize(), null, null);

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
    public FileUploadResponse storeDocument(MultipartFile file, String subDirectory) {
        return storeDocument(file, subDirectory, null, null);
    }

    @Override
    public FileUploadResponse storeDocument(MultipartFile file, String subDirectory, UUID bookingId, UUID facilityId) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.FILE_UPLOAD_EMPTY);
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            log.warn("Document size {} exceeds maximum 10MB limit", file.getSize());
            throw new AppException(ErrorCode.FILE_TOO_LARGE);
        }

        String originalFilename = StringUtils.cleanPath(Objects.requireNonNullElse(file.getOriginalFilename(), ""));
        String extension = originalFilename.contains(".") ? getFileExtension(originalFilename).toLowerCase() : "";
        if (!ALLOWED_DOCUMENT_EXTENSIONS.contains(extension) || !isContentTypeCompatible(file.getContentType(), extension)) {
            log.warn("Rejected document upload: extension={}, contentType={}", extension, file.getContentType());
            throw new AppException(ErrorCode.FILE_FORMAT_NOT_ALLOWED);
        }

        try {
            byte[] content = file.getBytes();
            if (!matchesMagicBytes(content, extension)) {
                log.warn("Rejected document upload: content does not look like .{}", extension);
                throw new AppException(ErrorCode.FILE_FORMAT_NOT_ALLOWED);
            }

            String safeSubDir = sanitizeSubDirectory(subDirectory);
            Path targetDirectory = this.rootUploadPath.resolve(safeSubDir).normalize();
            Files.createDirectories(targetDirectory);

            String storedFileName = UUID.randomUUID() + "." + (extension.equals("jpeg") ? "jpg" : extension);
            Files.write(targetDirectory.resolve(storedFileName), content);

            String fileUrl = "/uploads/" + safeSubDir + "/" + storedFileName;
            log.info("Stored uploaded document {} ({} bytes)", fileUrl, content.length);
            register(fileUrl, safeSubDir, originalFilename, file.getContentType(), content.length, bookingId, facilityId);

            return FileUploadResponse.builder()
                    .fileName(storedFileName)
                    .fileUrl(fileUrl)
                    .fileType(extension.equals("pdf") ? "application/pdf" : "image/" + (extension.equals("jpg") ? "jpeg" : extension))
                    .fileSize(content.length)
                    .uploadedAt(LocalDateTime.now())
                    .build();
        } catch (IOException e) {
            log.error("Could not store document {}", originalFilename, e);
            throw new AppException(ErrorCode.FILE_UPLOAD_FAILED);
        }
    }

    // =========================================================================
    // Registry: who uploaded what, and which record a file may be used for
    // =========================================================================

    private void register(String fileUrl, String category, String originalName, String contentType, long size,
                          UUID bookingId, UUID facilityId) {
        if (storedFileRepository == null) {
            return;
        }
        UUID uploaderId = requestContext != null ? requestContext.currentUserId() : null;
        UUID scopeFacilityId = facilityId != null ? facilityId : (requestContext != null ? requestContext.currentUserFacilityId() : null);
        storedFileRepository.save(StoredFile.builder()
                .urlPath(fileUrl)
                .category(category)
                .originalName(originalName != null && originalName.length() > 255 ? originalName.substring(0, 255) : originalName)
                .contentType(contentType != null && contentType.length() > 100 ? contentType.substring(0, 100) : contentType)
                .sizeBytes(size)
                .uploadedById(uploaderId)
                .facilityId(scopeFacilityId)
                .bookingId(bookingId)
                .build());
    }

    @Override
    public Path resolveStoredPath(String urlPath) {
        if (urlPath == null) {
            return null;
        }
        java.util.regex.Matcher matcher = UploadUrlSigner.UPLOAD_PATH.matcher(urlPath);
        if (!matcher.matches()) {
            return null;
        }
        Path resolved = rootUploadPath.resolve(matcher.group(1)).resolve(matcher.group(2)).normalize();
        if (!resolved.startsWith(rootUploadPath) || !Files.isRegularFile(resolved)) {
            return null;
        }
        return resolved;
    }

    @Override
    public boolean exists(String urlPath) {
        return resolveStoredPath(urlPath) != null;
    }

    @Override
    public void requireBookingEvidence(Collection<String> urls, UUID bookingId, UUID bookingFacilityId) {
        if (urls == null || urls.isEmpty()) {
            return;
        }
        for (String url : urls) {
            String path = UploadUrlSigner.normalizePath(url);
            if (path == null || !exists(path)) {
                throw new AppException(ErrorCode.HANDOVER_EVIDENCE_URL_INVALID);
            }
            if (storedFileRepository == null) {
                continue;
            }
            StoredFile stored = storedFileRepository.findByUrlPath(path).orElse(null);
            if (stored == null) {
                // Not uploaded through this API (hand-typed path or a file from another system).
                throw new AppException(ErrorCode.HANDOVER_EVIDENCE_URL_INVALID);
            }
            if (stored.getBookingId() != null && !stored.getBookingId().equals(bookingId)) {
                throw new AppException(ErrorCode.HANDOVER_EVIDENCE_URL_INVALID,
                        "Tệp minh chứng này đã được tải lên cho một đơn khác. Hãy tải lại tệp cho đơn hiện tại");
            }
            if (stored.getFacilityId() != null && bookingFacilityId != null && !stored.getFacilityId().equals(bookingFacilityId)) {
                throw new AppException(ErrorCode.HANDOVER_EVIDENCE_URL_INVALID,
                        "Tệp minh chứng này thuộc về một cơ sở khác. Hãy tải lại tệp cho đơn hiện tại");
            }
            if (stored.getBookingId() == null) {
                // First use: the file now belongs to this booking and cannot be reused for another one.
                stored.setBookingId(bookingId);
                storedFileRepository.save(stored);
            }
        }
    }

    @Override
    public void requireOwnUploads(Collection<String> urls, String category) {
        if (urls == null || urls.isEmpty()) {
            return;
        }
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        for (String url : urls) {
            String path = UploadUrlSigner.normalizePath(url);
            if (path == null || !path.startsWith("/uploads/" + category + "/") || !exists(path)) {
                throw new AppException(ErrorCode.TICKET_EVIDENCE_INVALID);
            }
            if (storedFileRepository == null) {
                continue;
            }
            StoredFile stored = storedFileRepository.findByUrlPath(path).orElse(null);
            if (stored == null || stored.getUploadedById() == null || !stored.getUploadedById().equals(currentUserId)) {
                throw new AppException(ErrorCode.TICKET_EVIDENCE_INVALID);
            }
        }
    }

    /** Only letters, digits, '-' and '_' are allowed, so a caller can never walk out of the upload root. */
    private String sanitizeSubDirectory(String subDirectory) {
        if (subDirectory != null && SAFE_SUB_DIRECTORY.matcher(subDirectory.trim()).matches()) {
            return subDirectory.trim();
        }
        return "general";
    }

    private boolean isContentTypeCompatible(String contentType, String extension) {
        if (contentType == null || contentType.isBlank() || "application/octet-stream".equalsIgnoreCase(contentType)) {
            return true;
        }
        String type = contentType.toLowerCase();
        return "pdf".equals(extension) ? type.equals("application/pdf") : type.startsWith("image/");
    }

    private boolean matchesMagicBytes(byte[] content, String extension) {
        if (content.length < 12) {
            return false;
        }
        switch (extension) {
            case "pdf":
                return content[0] == '%' && content[1] == 'P' && content[2] == 'D' && content[3] == 'F' && content[4] == '-';
            case "jpg":
            case "jpeg":
                return (content[0] & 0xFF) == 0xFF && (content[1] & 0xFF) == 0xD8 && (content[2] & 0xFF) == 0xFF;
            case "png":
                return (content[0] & 0xFF) == 0x89 && content[1] == 'P' && content[2] == 'N' && content[3] == 'G';
            case "webp":
                return content[0] == 'R' && content[1] == 'I' && content[2] == 'F' && content[3] == 'F'
                        && content[8] == 'W' && content[9] == 'E' && content[10] == 'B' && content[11] == 'P';
            default:
                return false;
        }
    }

    private String getFileExtension(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex > 0 && dotIndex < filename.length() - 1) {
            return filename.substring(dotIndex + 1);
        }
        return "jpg";
    }
}
