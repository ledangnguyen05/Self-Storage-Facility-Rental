package com.boxora.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        // Cố ý chỉ phục vụ tài sản tĩnh công cộng trong /uploads/public/**
        // Các tài liệu nhạy cảm (contracts, payments, handovers) tuyệt đối không phục vụ tĩnh,
        // mà bắt buộc truy xuất qua endpoint có phân quyền HandoverController.viewAuthorizedDocument
        registry.addResourceHandler("/uploads/public/**")
                .addResourceLocations("file:" + uploadPath.resolve("public").toString() + "/");
    }
}

