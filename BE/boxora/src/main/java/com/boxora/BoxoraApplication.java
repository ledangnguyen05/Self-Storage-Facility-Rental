package com.boxora;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class BoxoraApplication {

    static {
        // Tự động tìm và đọc file .env ở thư mục gốc của project
        Dotenv dotenv = Dotenv.configure()
                .ignoreIfMissing()
                .load();

        // Nạp tất cả các key-value trong .env thành System Properties của Java
        dotenv.entries().forEach(entry -> {
            if (System.getProperty(entry.getKey()) == null) {
                System.setProperty(entry.getKey(), entry.getValue());
            }
        });

        // Tắt cơ chế devtools restart để tránh xung đột bytecode / RestartClassLoader
        System.setProperty("spring.devtools.restart.enabled", "false");

        // Đồng bộ múi giờ mặc định sang giờ Việt Nam (UTC+7 / Asia/Ho_Chi_Minh) ngay khi JVM khởi động
        java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));
        System.setProperty("user.timezone", "Asia/Ho_Chi_Minh");
    }

    @jakarta.annotation.PostConstruct
    public void init() {
        // Đồng bộ múi giờ mặc định sang giờ Việt Nam (UTC+7)
        java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));
    }

    public static void main(String[] args) {
        SpringApplication.run(BoxoraApplication.class, args);
    }
}
