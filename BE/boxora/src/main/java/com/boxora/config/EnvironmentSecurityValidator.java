
package com.boxora.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.Set;

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

    public EnvironmentSecurityValidator(Environment environment) {
        this.environment = environment;
    }

    /**
     * Reads an environment variable first, then falls back to
     * the corresponding Spring property.
     */
    private String getConfig(String environmentVariable, String springProperty) {
        String value = environment.getProperty(environmentVariable);

        if (value == null || value.isBlank()) {
            value = environment.getProperty(springProperty);
        }

        return value == null ? "" : value.trim();
    }

    @Override
    public void run(ApplicationArguments args) {

        List<String> activeProfiles =
                Arrays.asList(environment.getActiveProfiles());

        boolean isProduction =
                activeProfiles.contains("prod")
                        || activeProfiles.contains("production");

        if (!isProduction) {
            log.debug("Development/Test profile active. Default sandbox secrets permitted.");
            return;
        }

        log.info("Production profile detected. Performing strict environment secrets validation...");

        // 1. JWT_SECRET
        String jwtSecret = getConfig(
                "JWT_SECRET",
                "jwt.secret"
        );

        if (jwtSecret.isBlank()
                || DEFAULT_DEV_JWT_SECRET.equals(jwtSecret)) {
            throw new IllegalStateException(
                    "CRITICAL SECURITY ERROR: Production deployment must set a strong, non-default JWT_SECRET environment variable."
            );
        }

        // 2. VNPAY_HASH_SECRET
     String vnpayHashSecret = getConfig(
        "VNPAY_HASH_SECRET",
        "vnpay.hash-secret"
);

if (vnpayHashSecret.isBlank()) {
    throw new IllegalStateException(
        "CRITICAL SECURITY ERROR: VNPAY_HASH_SECRET must not be blank."
    );
}

        // 3. DOCUSEAL_WEBHOOK_TOKEN
        String docusealWebhookToken = getConfig(
                "DOCUSEAL_WEBHOOK_TOKEN",
                "docuseal.webhook-token"
        );

        if (docusealWebhookToken.isBlank()
                || DEFAULT_DEV_DOCUSEAL_WEBHOOK.equals(docusealWebhookToken)) {
            throw new IllegalStateException(
                    "CRITICAL SECURITY ERROR: Production deployment must set a secure DOCUSEAL_WEBHOOK_TOKEN environment variable."
            );
        }

        // 4. DB_PASSWORD
        // Supports both the project's DB_PASSWORD and Spring Boot's standard variable.
        String dbPassword = getConfig(
                "DB_PASSWORD",
                "spring.datasource.password"
        );

        if (dbPassword.isBlank()
                || INSECURE_DEFAULT_PASSWORDS.contains(dbPassword.toLowerCase())) {
            throw new IllegalStateException(
                    "CRITICAL SECURITY ERROR: Production deployment must set a strong, non-default DB_PASSWORD environment variable."
            );
        }

        // 5. BOXORA_SEED_ENABLED
        // Supports both the project's environment variable and Spring property.
        String seedEnabledValue = getConfig(
                "BOXORA_SEED_ENABLED",
                "boxora.seed.enabled"
        );

        boolean seedEnabled = Boolean.parseBoolean(seedEnabledValue);

        if (seedEnabled) {
            throw new IllegalStateException(
                    "CRITICAL CONFIGURATION ERROR: Seed fixtures must not be enabled in production workflows. BOXORA_SEED_ENABLED must be false."
            );
        }

        log.info("Production environment secrets validation passed successfully.");
    }
}
