package com.boxora;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BoxoraApplication {

    public static void main(String[] args) {
        // Tự động tìm và đọc file .env ở thư mục gốc của project
        Dotenv dotenv = Dotenv.configure()
                .ignoreIfMissing()
                .load();

        // Nạp tất cả các key-value trong .env thành System Properties của Java
        dotenv.entries().forEach(entry ->
                System.setProperty(entry.getKey(), entry.getValue())
        );
        SpringApplication.run(BoxoraApplication.class, args);
    }

}
