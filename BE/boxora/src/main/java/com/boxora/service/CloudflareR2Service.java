package com.boxora.service;

import com.boxora.dto.response.FileUploadResponse;
import org.springframework.web.multipart.MultipartFile;

public interface CloudflareR2Service {

    /**
     * Upload an image file directly to Cloudflare R2 bucket and return the public CDN URL
     *
     * @param file   The multipart file to upload
     * @param folder The folder path inside the R2 bucket (e.g. "units", "facilities", "tickets")
     * @return FileUploadResponse containing the public R2 URL
     */
    FileUploadResponse uploadFile(MultipartFile file, String folder);

    /**
     * Specialized helper for uploading storage unit images to "units" directory on Cloudflare R2
     *
     * @param file The storage unit image
     * @return FileUploadResponse containing the public R2 URL
     */
    FileUploadResponse uploadUnitImage(MultipartFile file);

    /**
     * Specialized helper for uploading facility images to "facilities" directory on Cloudflare R2
     *
     * @param file The facility image
     * @return FileUploadResponse containing the public R2 URL
     */
    FileUploadResponse uploadFacilityImage(MultipartFile file);
}
