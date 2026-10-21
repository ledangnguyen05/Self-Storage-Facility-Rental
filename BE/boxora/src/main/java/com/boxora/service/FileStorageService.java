package com.boxora.service;

import com.boxora.dto.response.FileUploadResponse;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface FileStorageService {

    /**
     * Lưu trữ một file ảnh tải lên và trả về thông tin file cùng URL truy cập
     * @param file Tệp tin Multipart
     * @param subDirectory Thư mục con (ví dụ "tickets", "handovers")
     * @return FileUploadResponse chứa URL truy cập tệp
     */
    FileUploadResponse storeFile(MultipartFile file, String subDirectory);

    /**
     * Lưu trữ nhiều file ảnh tải lên và trả về danh sách FileUploadResponse
     */
    List<FileUploadResponse> storeFiles(List<MultipartFile> files, String subDirectory);

    /**
     * Lưu một tài liệu hoặc ảnh (JPG, PNG, WEBP, PDF, tối đa 10 MB) như bản scan hợp đồng giấy, biên lai chuyển khoản
     * hoặc ảnh nghiệm thu. Kiểm tra cả phần mở rộng, content type và chữ ký đầu tệp; tên tệp lưu là UUID khó đoán.
     */
    FileUploadResponse storeDocument(MultipartFile file, String subDirectory);

    /**
     * Like {@link #storeDocument(MultipartFile, String)}, remembering the booking and facility the file is uploaded for,
     * so that it cannot later be attached to another booking.
     */
    FileUploadResponse storeDocument(MultipartFile file, String subDirectory, UUID bookingId, UUID facilityId);

    /** The file on disk behind a stored {@code /uploads/<dir>/<file>} path, or null when the path is invalid or the file is gone. */
    Path resolveStoredPath(String urlPath);

    /** True when the stored path names a file that still exists. */
    boolean exists(String urlPath);

    /**
     * Handover evidence (photos, receipts, paper contract scans) must be files uploaded through the API that still exist
     * and were not uploaded for another booking or facility. A file used for the first time is bound to the booking.
     *
     * @throws com.boxora.exception.AppException HANDOVER_EVIDENCE_URL_INVALID
     */
    void requireBookingEvidence(Collection<String> urls, UUID bookingId, UUID bookingFacilityId);

    /**
     * Evidence the signed-in user attaches to a record in {@code category} (for example "tickets") must be files that same
     * user uploaded through the API and that still exist.
     *
     * @throws com.boxora.exception.AppException TICKET_EVIDENCE_INVALID
     */
    void requireOwnUploads(Collection<String> urls, String category);
}
