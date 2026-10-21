package com.boxora.util;

import java.util.regex.Pattern;

/** Format rules for the ID document a customer shows at the front desk. */
public final class IdentityDocuments {

    public static final String CCCD = "CCCD";
    public static final String PASSPORT = "PASSPORT";

    /** Old 9-digit CMND or the 12-digit citizen card. A 10-11 digit string is a phone number, not an ID. */
    private static final Pattern CCCD_PATTERN = Pattern.compile("^([0-9]{9}|[0-9]{12})$");
    /** Letters and digits, at least one digit (Vietnamese passports look like B1234567). */
    private static final Pattern PASSPORT_PATTERN = Pattern.compile("^(?=.*[0-9])[A-Za-z0-9]{6,12}$");

    private IdentityDocuments() {
    }

    /** CCCD unless the value says PASSPORT. */
    public static String normalizeType(String type) {
        return type != null && PASSPORT.equalsIgnoreCase(type.trim()) ? PASSPORT : CCCD;
    }

    /** Name of the document type for messages shown to staff: "CCCD" or "Hộ chiếu". */
    public static String label(String type) {
        return PASSPORT.equals(normalizeType(type)) ? "Hộ chiếu" : CCCD;
    }

    public static boolean isSupportedType(String type) {
        if (type == null || type.isBlank()) {
            return true;
        }
        String value = type.trim();
        return CCCD.equalsIgnoreCase(value) || PASSPORT.equalsIgnoreCase(value);
    }

    public static boolean isValidNumber(String type, String number) {
        if (number == null) {
            return false;
        }
        String value = number.trim();
        return PASSPORT.equals(normalizeType(type))
                ? PASSPORT_PATTERN.matcher(value).matches()
                : CCCD_PATTERN.matcher(value).matches();
    }

    /** Shows only the last four characters ({@code ********1234}); used wherever a number is written into free text. */
    public static String mask(String number) {
        if (number == null || number.isBlank()) {
            return "";
        }
        String value = number.trim();
        if (value.length() <= 4) {
            return "*".repeat(value.length());
        }
        return "*".repeat(value.length() - 4) + value.substring(value.length() - 4);
    }

    /** Passports are stored upper-case; CCCD digits are kept as typed. */
    public static String normalizeNumber(String type, String number) {
        String value = number == null ? "" : number.trim();
        return PASSPORT.equals(normalizeType(type)) ? value.toUpperCase() : value;
    }
}
