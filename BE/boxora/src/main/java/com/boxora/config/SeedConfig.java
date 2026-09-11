package com.boxora.config;

import com.boxora.entity.Role;
import com.boxora.entity.User;
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
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        seedUsers();
    }

    private void seedUsers() {

        // Chỉ seed nếu chưa có user nào trong DB
        if (userRepository.count() > 0) {
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
                "ADMIN"

        );

        createUser(
                "facility_manager",
                "facility@gmail.com",
                facilityManagerPassword,
                "System Facility Manager",
                "0372345678",
                "FACILITY_MANAGER"
        );

        createUser(
                "business_manager",
                "business@gmail.com",
                businessManagerPassword,
                "System Manager",
                "0373456789",
                "BUSINESS_MANAGER"
        );

        createUser(
                "staff",
                "staff@gmail.com",
                staffPassword,
                "System Staff",
                "0374567890",
                "STAFF"
        );

        createUser(
                "customer",
                "customer@gmail.com",
                customerPassword,
                "System Customer",
                "0373214567",
                "CUSTOMER"
        );

        log.info("Default users seeded successfully");
    }

    private void createUser(
            String username,
            String email,
            String rawPassword,
            String fullName,
            String phone,
            String roleName
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
                .isActive(true)
                .build();

        userRepository.save(user);

        log.info("Created user: {} ({})", username, email);
    }
}