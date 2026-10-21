package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.FileSignRequest;
import com.boxora.dto.response.SignedFileResponse;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.service.FileStorageService;
import com.boxora.service.impl.FileStorageAccessService;
import com.boxora.service.impl.UploadUrlSigner;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Locale;

/**
 * Uploaded evidence is private: GET /uploads/** only answers for a link signed by POST /api/v1/files/sign, which the API
 * hands out only to users who may see the record the file belongs to.
 */
@RestController
@Tag(name = "Uploaded files", description = "Liên kết ký số, có hạn ngắn tới tệp minh chứng đã tải lên (biên lai, hợp đồng giấy, ảnh nghiệm thu, ảnh sự cố)")
@RequiredArgsConstructor
public class FileStorageController {

    private final FileStorageAccessService accessService;
    private final FileStorageService fileStorageService;
    private final UploadUrlSigner signer;

    @PostMapping("/api/v1/files/sign")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Lấy liên kết có chữ ký (hiệu lực ngắn) để xem các tệp minh chứng mà người dùng được phép xem")
    public ResponseEntity<ApiResponse<List<SignedFileResponse>>> sign(@Valid @RequestBody FileSignRequest request) {
        return ResponseEntity.ok(ApiResponse.success(accessService.sign(request.getUrls())));
    }

    @GetMapping("/uploads/{dir}/{name}")
    @Operation(summary = "Tải một tệp đã upload bằng liên kết có chữ ký (exp, sig) do /api/v1/files/sign cấp")
    public ResponseEntity<Resource> serve(
            @PathVariable String dir,
            @PathVariable String name,
            @RequestParam(value = "exp", required = false) String exp,
            @RequestParam(value = "sig", required = false) String sig) {
        String path = "/uploads/" + dir + "/" + name;
        if (!signer.verify(path, parseExpiry(exp), sig)) {
            throw new AppException(ErrorCode.FILE_LINK_INVALID);
        }
        Path file = fileStorageService.resolveStoredPath(path);
        if (file == null) {
            throw new AppException(ErrorCode.FILE_NOT_FOUND);
        }
        return ResponseEntity.ok()
                .contentType(mediaTypeOf(name))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .header("X-Content-Type-Options", "nosniff")
                .header("Referrer-Policy", "no-referrer")
                // The link lives for minutes; the browser may reuse the bytes for as long, but shared caches must not keep them.
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePrivate())
                .body(new FileSystemResource(file));
    }

    private static Long parseExpiry(String exp) {
        if (exp == null || exp.isBlank() || exp.length() > 12) {
            return null;
        }
        try {
            return Long.parseLong(exp.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    static MediaType mediaTypeOf(String fileName) {
        String lower = fileName.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".png")) {
            return MediaType.IMAGE_PNG;
        }
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
            return MediaType.IMAGE_JPEG;
        }
        if (lower.endsWith(".gif")) {
            return MediaType.IMAGE_GIF;
        }
        if (lower.endsWith(".webp")) {
            return MediaType.parseMediaType("image/webp");
        }
        if (lower.endsWith(".pdf")) {
            return MediaType.APPLICATION_PDF;
        }
        return MediaType.APPLICATION_OCTET_STREAM;
    }
}
