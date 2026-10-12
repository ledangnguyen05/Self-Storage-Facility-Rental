package com.boxora.config;

import com.boxora.entity.Facility;
import com.boxora.entity.Role;
import com.boxora.entity.User;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.RoleRepository;
import com.boxora.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
@Slf4j
public class SeedConfig implements ApplicationRunner {

    @Value("${seed.admin-password}")
    private String adminPassword;

    @Value("${seed.facility-manager-password}")
    private String facilityManagerPassword;

    @Value("${seed.business-manager-password}")
    private String businessManagerPassword;

    @Value("${seed.staff-password}")
    private String staffPassword;

    @Value("${seed.customer-password}")
    private String customerPassword;

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final FacilityRepository facilityRepository;
    private final PasswordEncoder passwordEncoder;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        try {
            jdbcTemplate.execute("ALTER TABLE bookings ALTER COLUMN access_pin TYPE VARCHAR(255)");
        } catch (Exception e) {
            log.warn("Notice altering bookings.access_pin: {}", e.getMessage());
        }
        seedUsers();
    }

    private void seedUsers() {
        Facility facilityD1 = facilityRepository.findByCode("HCM-D1").orElse(null);
        Facility facilityD7 = facilityRepository.findByCode("HCM-D7").orElse(null);

        // Neu DB da co user, kiem tra va gan bo sung facility neu chua co
        if (userRepository.count() > 0) {
            backfillUserFacilities(facilityD1, facilityD7);
            log.info("Users already seeded — skipping");
            return;
        }

        log.info("Seeding default users...");

        createUser(
                "admin",
                "admin@gmail.com",
                adminPassword,
                "System Administrator",
                "0371234567",
                "ADMIN",
                null
        );

        User facilityManager = createUser(
                "facility_manager",
                "facility@gmail.com",
                facilityManagerPassword,
                "System Facility Manager",
                "0372345678",
                "FACILITY_MANAGER",
                facilityD1
        );

        if (facilityD1 != null && facilityManager != null) {
            facilityD1.setManager(facilityManager);
            facilityRepository.save(facilityD1);
            log.info("Assigned facility_manager as manager of {}", facilityD1.getName());
        }

        createUser(
                "business_manager",
                "business@gmail.com",
                businessManagerPassword,
                "System Manager",
                "0373456789",
                "BUSINESS_MANAGER",
                null
        );

        createUser(
                "staff",
                "staff@gmail.com",
                staffPassword,
                "System Staff (D1)",
                "0374567890",
                "STAFF",
                facilityD1
        );

        createUser(
                "staff_d7",
                "staff_d7@gmail.com",
                staffPassword,
                "System Staff (D7)",
                "0374567891",
                "STAFF",
                facilityD7
        );

        createUser(
                "customer",
                "customer@gmail.com",
                customerPassword,
                "System Customer",
                "0373214567",
                "CUSTOMER",
                null
        );

        log.info("Default users seeded successfully");
    }

    private void backfillUserFacilities(Facility facilityD1, Facility facilityD7) {
        if (facilityD1 != null) {
            userRepository.findByUsername("facility_manager").ifPresent(fm -> {
                if (fm.getFacility() == null) {
                    fm.setFacility(facilityD1);
                    userRepository.save(fm);
                    facilityD1.setManager(fm);
                    facilityRepository.save(facilityD1);
                    log.info("Backfilled facility for user facility_manager -> {}", facilityD1.getName());
                }
            });

            userRepository.findByUsername("staff").ifPresent(st -> {
                if (st.getFacility() == null) {
                    st.setFacility(facilityD1);
                    userRepository.save(st);
                    log.info("Backfilled facility for user staff -> {}", facilityD1.getName());
                }
            });
        }

        if (facilityD7 != null) {
            userRepository.findByUsername("staff_d7").ifPresent(st -> {
                if (st.getFacility() == null) {
                    st.setFacility(facilityD7);
                    userRepository.save(st);
                    log.info("Backfilled facility for user staff_d7 -> {}", facilityD7.getName());
                }
            });
        }
    }

    private User createUser(
            String username,
            String email,
            String rawPassword,
            String fullName,
            String phone,
            String roleName,
            Facility facility
    ) {
        Role role = roleRepository.findByName(roleName)
                .orElseThrow(() ->
                        new RuntimeException("Role not found: " + roleName)
                );

        User user = User.builder()
                .username(username)
                .email(email)
                .password(passwordEncoder.encode(rawPassword))
                .fullName(fullName)
                .phone(phone)
                .role(role)
                .facility(facility)
                .isActive(true)
                .build();

        User saved = userRepository.save(user);

        log.info("Created user: {} ({}) with role {} and facility {}",
                username, email, roleName, facility != null ? facility.getName() : "None");
        return saved;
    }
}