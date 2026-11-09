package com.boxora.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashSet;
import java.util.Set;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Set<String> locations = new LinkedHashSet<>();

        // 1. Primary configured upload directory
        addPathLocation(locations, Paths.get(uploadDir));

        // 2. Candidate directories for root or submodule working directories on Windows/Linux
        addPathLocation(locations, Paths.get("uploads"));
        addPathLocation(locations, Paths.get("BE", "boxora", "uploads"));
        addPathLocation(locations, Paths.get("..", "BE", "boxora", "uploads"));
        addPathLocation(locations, Paths.get("..", "uploads"));

        // Phục vụ toàn bộ các tài nguyên tĩnh trong thư mục /uploads/**
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(locations.toArray(new String[0]));
    }

    private void addPathLocation(Set<String> locations, Path path) {
        try {
            Path absPath = path.toAbsolutePath().normalize();
            File file = absPath.toFile();
            if (!file.exists()) {
                file.mkdirs();
            }
            String uriStr = absPath.toUri().toString();
            if (!uriStr.endsWith("/")) {
                uriStr += "/";
            }
            locations.add(uriStr);
        } catch (Exception ignored) {
        }
    }
}
