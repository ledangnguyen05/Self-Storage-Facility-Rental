package com.boxora;

import com.boxora.config.EnvironmentSecurityValidator;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

public class MigrationVerificationTest {

    private static final String POSTGRES_USER = "postgres";
    private static final String POSTGRES_PASSWORD = "12345";

    @Test
    @DisplayName("Phase E: Verify all Flyway migrations (V1 to V35) succeed cleanly on a disposable clean database")
    void testMigrationOnDisposableCleanDatabase() {
        String cleanDbUrl = "jdbc:postgresql://localhost:5432/boxora_disposable_clean";

        Flyway flyway = Flyway.configure()
                .dataSource(cleanDbUrl, POSTGRES_USER, POSTGRES_PASSWORD)
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .validateOnMigrate(false)
                .cleanDisabled(false)
                .load();

        // Ensure clean state
        flyway.clean();

        // Migrate all scripts from scratch
        MigrateResult result = flyway.migrate();
        assertTrue(result.success, "Clean database migration should succeed");
        assertTrue(result.migrationsExecuted > 0, "Should execute all migrations on a clean database");
        assertEquals("35", flyway.info().current().getVersion().getVersion(), "Current version should be 35");
    }

    @Test
    @DisplayName("Phase E: Verify Flyway migrations succeed on a safe copy of the existing database")
    void testMigrationOnSafeCopyOfExistingDatabase() {
        String existingCopyUrl = "jdbc:postgresql://localhost:5432/boxora_existing_copy";

        Flyway flyway = Flyway.configure()
                .dataSource(existingCopyUrl, POSTGRES_USER, POSTGRES_PASSWORD)
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .validateOnMigrate(false)
                .load();

        MigrateResult result = flyway.migrate();
        assertTrue(result.success, "Migration on existing database copy should succeed");
        assertEquals("35", flyway.info().current().getVersion().getVersion(), "Current version should be 35");
    }

    @Test
    @DisplayName("Phase E: Production startup MUST fail if mandatory secrets are missing or dev defaults")
    void testProductionStartupFailsOnMissingSecrets() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");

        EnvironmentSecurityValidator validator = new EnvironmentSecurityValidator(env);
        // Leaving jwtSecret, vnpayHashSecret, docusealWebhookToken as defaults
        ReflectionTestUtils.setField(validator, "jwtSecret", "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970");
        ReflectionTestUtils.setField(validator, "vnpayHashSecret", "VLRAQQHFJORSSMHIDNAJMKPGGHTSRQRE");
        ReflectionTestUtils.setField(validator, "docusealWebhookToken", "boxora_docuseal_webhook_secret");
        ReflectionTestUtils.setField(validator, "dbPassword", "12345");
        ReflectionTestUtils.setField(validator, "seedEnabled", false);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> validator.run(null));
        assertTrue(ex.getMessage().contains("CRITICAL SECURITY ERROR"), "Startup must fail on dev secrets in prod");
    }

    @Test
    @DisplayName("Phase E: Production startup MUST fail if seed fixtures are enabled")
    void testProductionStartupFailsIfSeedEnabled() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");

        EnvironmentSecurityValidator validator = new EnvironmentSecurityValidator(env);
        ReflectionTestUtils.setField(validator, "jwtSecret", "super-secret-production-jwt-key-with-sufficient-entropy-998877");
        ReflectionTestUtils.setField(validator, "vnpayHashSecret", "PROD_VNPAY_HASH_SECRET_KEY_12345678");
        ReflectionTestUtils.setField(validator, "docusealWebhookToken", "prod_docuseal_secure_token_9999");
        ReflectionTestUtils.setField(validator, "dbPassword", "StrongProdPassword!2026");
        ReflectionTestUtils.setField(validator, "seedEnabled", true); // seeds accidentally enabled

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> validator.run(null));
        assertTrue(ex.getMessage().contains("Seed fixtures must not be enabled in production"), "Startup must fail if seeds enabled in prod");
    }
}
