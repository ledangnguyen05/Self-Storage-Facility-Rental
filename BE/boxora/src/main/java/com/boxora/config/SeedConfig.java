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
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("!prod & !production")
@ConditionalOnProperty(name = "boxora.seed.enabled", havingValue = "true")
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

    public SeedConfig(
            UserRepository userRepository,
            RoleRepository roleRepository,
            FacilityRepository facilityRepository,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.facilityRepository = facilityRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        log.info("Checking opt-in non-production seed fixtures...");
        seedUsers();
    }

    private void seedUsers() {
        if (userRepository.count() > 0) {
            log.info("Users already exist — skipping seed fixtures without modifying existing assignments");
            return;
        }

        Facility facilityD1 = facilityRepository.findByCode("HCM-D1").orElse(null);
        Facility facilityD7 = facilityRepository.findByCode("HCM-D7").orElse(null);

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