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
}

