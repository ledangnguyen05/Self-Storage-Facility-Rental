package com.boxora.config;

import com.boxora.entity.Permission;
import com.boxora.entity.Role;
import com.boxora.entity.RolePermission;
import com.boxora.entity.User;
import com.boxora.repository.PermissionRepository;
import com.boxora.repository.RolePermissionRepository;
import com.boxora.repository.RoleRepository;
import com.boxora.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.*;

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
    private final PermissionRepository permissionRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(ApplicationArguments args) {
        seedRoles();
        seedPermissions();
        seedRolePermissions();
        seedUsers();
    }

    private void seedRoles() {
        if (roleRepository.count() > 0) {
            return;
        }
        log.info("Seeding roles...");
        List<Role> roles = List.of(
                Role.builder().name("ADMIN").description("System administrator").isActive(true).build(),
                Role.builder().name("FACILITY_MANAGER").description("Facility manager").isActive(true).build(),
                Role.builder().name("BUSINESS_MANAGER").description("Business manager").isActive(true).build(),
                Role.builder().name("STAFF").description("Store staff").isActive(true).build(),
                Role.builder().name("CUSTOMER").description("Store customer").isActive(true).build()
        );
        roleRepository.saveAll(roles);
    }

    private void seedPermissions() {
        if (permissionRepository.count() > 0) {
            return;
        }
        log.info("Seeding permissions...");
        List<Permission> list = List.of(
                // USER
                Permission.builder().name("USER_VIEW").permissionGroup("USER").description("View users").isActive(true).build(),
                Permission.builder().name("USER_CREATE").permissionGroup("USER").description("Create users").isActive(true).build(),
                Permission.builder().name("USER_UPDATE").permissionGroup("USER").description("Update users").isActive(true).build(),
                Permission.builder().name("USER_DELETE").permissionGroup("USER").description("Delete users").isActive(true).build(),

                // ROLE
                Permission.builder().name("ROLE_VIEW").permissionGroup("ROLE").description("View roles").isActive(true).build(),
                Permission.builder().name("ROLE_CREATE").permissionGroup("ROLE").description("Create roles").isActive(true).build(),
                Permission.builder().name("ROLE_UPDATE").permissionGroup("ROLE").description("Update roles").isActive(true).build(),
                Permission.builder().name("ROLE_DELETE").permissionGroup("ROLE").description("Delete roles").isActive(true).build(),

                // FACILITY
                Permission.builder().name("FACILITY_VIEW").permissionGroup("FACILITY").description("View facilities").isActive(true).build(),
                Permission.builder().name("FACILITY_CREATE").permissionGroup("FACILITY").description("Create facilities").isActive(true).build(),
                Permission.builder().name("FACILITY_UPDATE").permissionGroup("FACILITY").description("Update facilities").isActive(true).build(),
                Permission.builder().name("FACILITY_DELETE").permissionGroup("FACILITY").description("Delete facilities").isActive(true).build(),

                // STORAGE_UNIT
                Permission.builder().name("STORAGE_UNIT_VIEW").permissionGroup("STORAGE_UNIT").description("View storage units").isActive(true).build(),
                Permission.builder().name("STORAGE_UNIT_CREATE").permissionGroup("STORAGE_UNIT").description("Create storage units").isActive(true).build(),
                Permission.builder().name("STORAGE_UNIT_UPDATE").permissionGroup("STORAGE_UNIT").description("Update storage units").isActive(true).build(),
                Permission.builder().name("STORAGE_UNIT_DELETE").permissionGroup("STORAGE_UNIT").description("Delete storage units").isActive(true).build(),

                // BOOKING
                Permission.builder().name("BOOKING_VIEW").permissionGroup("BOOKING").description("View bookings").isActive(true).build(),
                Permission.builder().name("BOOKING_CREATE").permissionGroup("BOOKING").description("Create bookings").isActive(true).build(),
                Permission.builder().name("BOOKING_UPDATE").permissionGroup("BOOKING").description("Update bookings").isActive(true).build(),
                Permission.builder().name("BOOKING_CANCEL").permissionGroup("BOOKING").description("Cancel bookings").isActive(true).build(),

                // PAYMENT
                Permission.builder().name("PAYMENT_VIEW").permissionGroup("PAYMENT").description("View payments").isActive(true).build(),
                Permission.builder().name("PAYMENT_CREATE").permissionGroup("PAYMENT").description("Create payments").isActive(true).build(),

                // SUPPORT
                Permission.builder().name("SUPPORT_VIEW").permissionGroup("SUPPORT").description("View support tickets").isActive(true).build(),
                Permission.builder().name("SUPPORT_CREATE").permissionGroup("SUPPORT").description("Create support tickets").isActive(true).build(),
                Permission.builder().name("SUPPORT_UPDATE").permissionGroup("SUPPORT").description("Update support tickets").isActive(true).build(),

                // REPORT
                Permission.builder().name("REPORT_VIEW").permissionGroup("REPORT").description("View business reports").isActive(true).build(),

                // POLICY
                Permission.builder().name("POLICY_VIEW").permissionGroup("POLICY").description("View facility policies").isActive(true).build(),
                Permission.builder().name("POLICY_UPDATE").permissionGroup("POLICY").description("Update facility policies").isActive(true).build()
        );
        permissionRepository.saveAll(list);
    }

    private void seedRolePermissions() {
        if (rolePermissionRepository.count() > 0) {
            return;
        }
        log.info("Seeding role permissions...");
        List<Permission> allPermissions = permissionRepository.findAll();
        Map<String, Role> roleMap = new HashMap<>();
        roleRepository.findAll().forEach(r -> roleMap.put(r.getName(), r));

        List<RolePermission> toSave = new ArrayList<>();

        // ADMIN: all permissions
        Role adminRole = roleMap.get("ADMIN");
        if (adminRole != null) {
            for (Permission p : allPermissions) {
                toSave.add(RolePermission.builder().role(adminRole).permission(p).description("ADMIN full system access").isActive(true).build());
            }
        }

        // BUSINESS_MANAGER
        Role bmRole = roleMap.get("BUSINESS_MANAGER");
        if (bmRole != null) {
            Set<String> bmGroups = Set.of("FACILITY", "STORAGE_UNIT", "BOOKING", "PAYMENT", "REPORT", "POLICY");
            for (Permission p : allPermissions) {
                if (bmGroups.contains(p.getPermissionGroup())) {
                    toSave.add(RolePermission.builder().role(bmRole).permission(p).description("Business operations management permission").isActive(true).build());
                }
            }
        }

        // FACILITY_MANAGER
        Role fmRole = roleMap.get("FACILITY_MANAGER");
        if (fmRole != null) {
            Set<String> fmGroups = Set.of("FACILITY", "STORAGE_UNIT", "BOOKING", "PAYMENT", "SUPPORT", "REPORT");
            for (Permission p : allPermissions) {
                if (fmGroups.contains(p.getPermissionGroup())) {
                    toSave.add(RolePermission.builder().role(fmRole).permission(p).description("Facility manager permission").isActive(true).build());
                }
            }
        }

        // STAFF
        Role staffRole = roleMap.get("STAFF");
        if (staffRole != null) {
            Set<String> staffPerms = Set.of(
                    "FACILITY_VIEW", "STORAGE_UNIT_VIEW", "STORAGE_UNIT_UPDATE",
                    "BOOKING_VIEW", "BOOKING_UPDATE", "PAYMENT_VIEW",
                    "SUPPORT_VIEW", "SUPPORT_UPDATE"
            );
            for (Permission p : allPermissions) {
                if (staffPerms.contains(p.getName())) {
                    toSave.add(RolePermission.builder().role(staffRole).permission(p).description("Facility staff permission").isActive(true).build());
                }
            }
        }

        // CUSTOMER
        Role customerRole = roleMap.get("CUSTOMER");
        if (customerRole != null) {
            Set<String> customerPerms = Set.of(
                    "FACILITY_VIEW", "STORAGE_UNIT_VIEW", "BOOKING_VIEW",
                    "BOOKING_CREATE", "BOOKING_CANCEL", "PAYMENT_VIEW",
                    "PAYMENT_CREATE", "SUPPORT_VIEW", "SUPPORT_CREATE"
            );
            for (Permission p : allPermissions) {
                if (customerPerms.contains(p.getName())) {
                    toSave.add(RolePermission.builder().role(customerRole).permission(p).description("Customer permission").isActive(true).build());
                }
            }
        }

        if (!toSave.isEmpty()) {
            rolePermissionRepository.saveAll(toSave);
        }
    }

    private void seedUsers() {
        if (userRepository.count() > 0) {
            log.info("Users already seeded — skipping");
            return;
        }

        log.info("Seeding default users...");
        Map<String, Role> roleMap = new HashMap<>();
        roleRepository.findAll().forEach(r -> roleMap.put(r.getName(), r));

        List<User> users = List.of(
                User.builder().username("admin").email("admin@gmail.com").password(passwordEncoder.encode(adminPassword)).fullName("System Administrator").phone("0371234567").role(roleMap.get("ADMIN")).isActive(true).build(),
                User.builder().username("facility_manager").email("facility@gmail.com").password(passwordEncoder.encode(facilityManagerPassword)).fullName("System Facility Manager").phone("0372345678").role(roleMap.get("FACILITY_MANAGER")).isActive(true).build(),
                User.builder().username("business_manager").email("business@gmail.com").password(passwordEncoder.encode(businessManagerPassword)).fullName("System Manager").phone("0373456789").role(roleMap.get("BUSINESS_MANAGER")).isActive(true).build(),
                User.builder().username("staff").email("staff@gmail.com").password(passwordEncoder.encode(staffPassword)).fullName("System Staff").phone("0374567890").role(roleMap.get("STAFF")).isActive(true).build(),
                User.builder().username("customer").email("customer@gmail.com").password(passwordEncoder.encode(customerPassword)).fullName("System Customer").phone("0373214567").role(roleMap.get("CUSTOMER")).isActive(true).build()
        );

        userRepository.saveAll(users);
        log.info("Default users seeded successfully (5 users)");
    }
}