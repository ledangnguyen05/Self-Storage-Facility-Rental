package com.boxora.service.impl;

import com.boxora.enums.MasterKeyOverrideCategory;
import com.boxora.enums.OverrideSeverity;

/**
 * Vietnamese display names of the master-key enums, so audit entries, notifications and emails never show raw codes such as
 * LIFE_AND_SAFETY or CRITICAL. The wording matches the labels of the manager portal.
 */
public final class MasterKeyLabels {

    private MasterKeyLabels() {
    }

    public static String category(MasterKeyOverrideCategory category) {
        if (category == null) {
            return "—";
        }
        return switch (category) {
            case LIFE_AND_SAFETY -> "An toàn tính mạng, cháy nổ, rò rỉ";
            case LAW_ENFORCEMENT -> "Yêu cầu của cơ quan chức năng";
            case POLICY_ENFORCEMENT -> "Xử lý vi phạm hợp đồng, niêm phong";
            case TECHNICAL_INCIDENT -> "Sự cố kỹ thuật của khóa";
            case SPECIAL_CIRCUMSTANCE -> "Tình huống đặc biệt khác";
        };
    }

    public static String severity(OverrideSeverity severity) {
        if (severity == null) {
            return "—";
        }
        return switch (severity) {
            case CRITICAL -> "Khẩn cấp";
            case HIGH -> "Cao";
            case STANDARD -> "Tiêu chuẩn";
        };
    }

    /** For callers that only hold the enum name (the email layer). Unknown text is returned unchanged. */
    public static String category(String name) {
        return parse(name, MasterKeyOverrideCategory.class) != null
                ? category(MasterKeyOverrideCategory.valueOf(name)) : (name == null ? "—" : name);
    }

    /** For callers that only hold the enum name (the email layer). Unknown text is returned unchanged. */
    public static String severity(String name) {
        return parse(name, OverrideSeverity.class) != null
                ? severity(OverrideSeverity.valueOf(name)) : (name == null ? "—" : name);
    }

    private static <E extends Enum<E>> E parse(String name, Class<E> type) {
        if (name == null) {
            return null;
        }
        try {
            return Enum.valueOf(type, name);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
