package com.boxora.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.Set;

/**
 * Validates critical system secrets during startup.
 * In production profiles ("prod", "production"), startup is strictly aborted
 * if any mandatory security secret is missing or is left as a well-known development default.
 */
@Component
@Slf4j
public class EnvironmentSecurityValidator implements ApplicationRunner {

    private static final String DEFAULT_DEV_JWT_SECRET =
            "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970";
    private static final String DEFAULT_DEV_VNPAY_SECRET =
            "VLRAQQHFJORSSMHIDNAJMKPGGHTSRQRE";
    private static final String DEFAULT_DEV_DOCUSEAL_WEBHOOK =
            "boxora_docuseal_webhook_secret";

    private static final Set<String> INSECURE_DEFAULT_PASSWORDS = Set.of(
            "12345", "123456", "password", "postgres", "admin", "root", "secret"
    );

    private final Environment environment;

    @Value("${jwt.secret:}")
    private String jwtSecret;

    @Value("${vnpay.hash-secret:}")
    private String vnpayHashSecret;

    @Value("${docuseal.webhook-token:}")
    private String docusealWebhookToken;

    @Value("${spring.datasource.password:}")
    private String dbPassword;

    @Value("${boxora.seed.enabled:false}")
    private boolean seedEnabled;

    public EnvironmentSecurityValidator(Environment environment) {
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<String> activeProfiles = Arrays.asList(environment.getActiveProfiles());
        boolean isProduction = activeProfiles.contains("prod") || activeProfiles.contains("production");

        if (isProduction) {
            log.info("Production profile detected. Performing strict environment secrets validation...");

            if (jwtSecret == null || jwtSecret.isBlank() || DEFAULT_DEV_JWT_SECRET.equals(jwtSecret)) {
                throw new IllegalStateException("CRITICAL SECURITY ERROR: Production deployment must set a strong, non-default JWT_SECRET environment variable.");
            }
            if (vnpayHashSecret == null || vnpayHashSecret.isBlank() || DEFAULT_DEV_VNPAY_SECRET.equals(vnpayHashSecret)) {
                throw new IllegalStateException("CRITICAL SECURITY ERROR: Production deployment must set a valid VNPAY_HASH_SECRET environment variable.");
            }
            if (docusealWebhookToken == null || docusealWebhookToken.isBlank() || DEFAULT_DEV_DOCUSEAL_WEBHOOK.equals(docusealWebhookToken)) {
                throw new IllegalStateException("CRITICAL SECURITY ERROR: Production deployment must set a secure DOCUSEAL_WEBHOOK_TOKEN environment variable.");
            }
            if (dbPassword == null || dbPassword.isBlank() || INSECURE_DEFAULT_PASSWORDS.contains(dbPassword.toLowerCase())) {
                throw new IllegalStateException("CRITICAL SECURITY ERROR: Production deployment must set a strong, non-default database password (SPRING_DATASOURCE_PASSWORD / DB_PASSWORD).");
            }
            if (seedEnabled) {
                throw new IllegalStateException("CRITICAL CONFIGURATION ERROR: Seed fixtures must not be enabled in production workflows (boxora.seed.enabled must be false).");
            }

            log.info("Production environment secrets validation passed successfully.");
        } else {
            log.debug("Development/Test profile active. Default sandbox secrets permitted.");
        }
    }
}
