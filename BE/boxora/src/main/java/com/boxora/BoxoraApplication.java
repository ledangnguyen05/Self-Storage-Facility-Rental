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
    }

    public static void main(String[] args) {
        SpringApplication.run(BoxoraApplication.class, args);
    }
}
