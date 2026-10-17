package com.boxora.service;

import com.boxora.dto.response.FileUploadResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

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
     * Lưu trữ tài liệu nghiệp vụ (Hợp đồng giấy scan, chứng từ chuyển khoản: PDF, JPG, JPEG, PNG, WEBP, tối đa 10MB)
     * có kiểm tra phần mở rộng, MIME type và chữ ký byte (magic bytes).
     */
    FileUploadResponse storeDocumentFile(MultipartFile file, String subDirectory);

    /**
     * Xóa tệp đã tải lên theo fileUrl nếu tồn tại (dùng để dọn dẹp orphan file khi giao dịch DB thất bại).
     */
    void deleteFileIfExists(String fileUrl);

    /**
     * Phân giải đường dẫn vật lý an toàn từ fileUrl (/uploads/...).
     */
    java.nio.file.Path resolveStoredFilePath(String fileUrl);
}

