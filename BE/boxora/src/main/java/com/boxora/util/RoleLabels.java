package com.boxora.util;

/**
 * Vietnamese names of the account roles for messages the backend composes (audit entries, notifications), so a role
 * code such as FACILITY_MANAGER never reaches a person. The wording matches the web app's role labels.
 */
public final class RoleLabels {

    private RoleLabels() {
    }

    /** "Quản lý cơ sở", "Khách hàng", ... A custom role that has no fixed label keeps its own name. */
    public static String of(String roleName) {
        if (roleName == null || roleName.isBlank()) {
            return "chưa xác định";
        }
        return switch (roleName.trim().toUpperCase()) {
            case "ADMIN" -> "Quản trị viên";
            case "BUSINESS_MANAGER" -> "Giám đốc vận hành";
            case "FACILITY_MANAGER" -> "Quản lý cơ sở";
            case "STAFF" -> "Nhân viên";
            case "CUSTOMER" -> "Khách hàng";
            default -> roleName.trim();
        };
    }
}
