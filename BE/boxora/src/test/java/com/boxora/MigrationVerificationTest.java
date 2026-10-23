package com.boxora;

import com.boxora.config.EnvironmentSecurityValidator;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

import static org.junit.jupiter.api.Assertions.*;

public class MigrationVerificationTest {

    private static final String POSTGRES_USER = "postgres";
    private static final String POSTGRES_PASSWORD = "12345";

    @Test
    @DisplayName("Phase E: Verify all Flyway migrations succeed cleanly on a disposable clean database")
    void testMigrationOnDisposableCleanDatabase() throws Exception {
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
        assertEquals("46", flyway.info().current().getVersion().getVersion(), "Current version should be 46");
        assertColumnExists(cleanDbUrl, "handover_records", "door_condition_passed");
        assertColumnExists(cleanDbUrl, "bookings", "identity_original_document_seen");
        assertRolePermission(cleanDbUrl, "ADMIN", "REPORT_VIEW", true);
        assertRolePermission(cleanDbUrl, "ADMIN", "PAYMENT_VIEW", true);
        assertRolePermission(cleanDbUrl, "ADMIN", "OVERDUE_VIEW", true);
        assertRolePermission(cleanDbUrl, "ADMIN", "BOOKING_VIEW", true);
        assertRolePermission(cleanDbUrl, "ADMIN", "CONTRACT_VIEW", true);
        assertRolePermission(cleanDbUrl, "ADMIN", "HANDOVER_VIEW", true);
        assertRolePermission(cleanDbUrl, "ADMIN", "ACCESS_CREDENTIAL_VIEW", true);
        assertRolePermission(cleanDbUrl, "ADMIN", "RENEWAL_VIEW", true);
        assertRolePermission(cleanDbUrl, "ADMIN", "REFUND_VIEW", true);
        assertRolePermission(cleanDbUrl, "ADMIN", "PAYMENT_CREATE", false);
        assertRolePermission(cleanDbUrl, "ADMIN", "OVERDUE_PROCESS", false);
        assertRolePermission(cleanDbUrl, "ADMIN", "SEALING_CREATE", false);
        assertRolePermission(cleanDbUrl, "ADMIN", "PRICE_ADJUST", false);
        assertRolePermission(cleanDbUrl, "BUSINESS_MANAGER", "REPORT_VIEW", true);
        assertRolePermission(cleanDbUrl, "BUSINESS_MANAGER", "OVERDUE_VIEW", true);
        assertRolePermission(cleanDbUrl, "BUSINESS_MANAGER", "OVERDUE_PROCESS", false);
        assertRolePermission(cleanDbUrl, "BUSINESS_MANAGER", "SEALING_CREATE", false);
        assertRolePermission(cleanDbUrl, "FACILITY_MANAGER", "OVERDUE_PROCESS", true);
    }

    @Test
    @DisplayName("Phase E: Verify Flyway migrations succeed on a safe copy of the existing database")
    void testMigrationOnSafeCopyOfExistingDatabase() throws Exception {
        String existingCopyUrl = "jdbc:postgresql://localhost:5432/boxora_existing_copy";

        Flyway flyway = Flyway.configure()
                .dataSource(existingCopyUrl, POSTGRES_USER, POSTGRES_PASSWORD)
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .validateOnMigrate(false)
                .load();

        MigrateResult result = flyway.migrate();
        assertTrue(result.success, "Migration on existing database copy should succeed");
        assertEquals("46", flyway.info().current().getVersion().getVersion(), "Current version should be 46");
        assertColumnExists(existingCopyUrl, "handover_records", "wall_structure_passed");
        assertColumnExists(existingCopyUrl, "bookings", "identity_original_document_seen");
        assertRolePermission(existingCopyUrl, "ADMIN", "PAYMENT_CREATE", false);
        assertRolePermission(existingCopyUrl, "ADMIN", "BOOKING_VIEW", true);
        assertRolePermission(existingCopyUrl, "BUSINESS_MANAGER", "OVERDUE_VIEW", true);
        assertRolePermission(existingCopyUrl, "BUSINESS_MANAGER", "OVERDUE_PROCESS", false);
        assertRolePermission(existingCopyUrl, "FACILITY_MANAGER", "OVERDUE_PROCESS", true);
    }

    private void assertRolePermission(String jdbcUrl, String roleName, String permissionName, boolean expectedActive)
            throws Exception {
        String sql = "SELECT EXISTS (SELECT 1 FROM role_permissions rp "
                + "JOIN roles r ON r.id = rp.role_id "
                + "JOIN permissions p ON p.id = rp.permission_id "
                + "WHERE r.name = ? AND p.name = ? AND rp.is_active = TRUE AND p.is_active = TRUE)";
        try (Connection connection = DriverManager.getConnection(jdbcUrl, POSTGRES_USER, POSTGRES_PASSWORD);
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, roleName);
            statement.setString(2, permissionName);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next());
                assertEquals(expectedActive, result.getBoolean(1), roleName + " permission " + permissionName);
            }
        }
    }

    private void assertColumnExists(String jdbcUrl, String tableName, String columnName) throws Exception {
        String sql = "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
                + "WHERE table_schema = 'public' AND table_name = ? AND column_name = ?)";
        try (Connection connection = DriverManager.getConnection(jdbcUrl, POSTGRES_USER, POSTGRES_PASSWORD);
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, tableName);
            statement.setString(2, columnName);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next());
                assertTrue(result.getBoolean(1), tableName + "." + columnName + " should exist after migration");
            }
        }
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
