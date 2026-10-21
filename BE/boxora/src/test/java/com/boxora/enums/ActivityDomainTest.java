package com.boxora.enums;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ActivityDomainTest {

    @Test
    @DisplayName("Mỗi hành động nhật ký thuộc đúng một nhóm nghiệp vụ (nếu không, bộ lọc theo nhóm sẽ không bao giờ thấy nó)")
    void everyActionBelongsToExactlyOneDomain() {
        Map<ActivityAction, List<ActivityDomain>> owners = new EnumMap<>(ActivityAction.class);
        for (ActivityDomain domain : ActivityDomain.values()) {
            for (ActivityAction action : domain.actions()) {
                owners.computeIfAbsent(action, a -> new ArrayList<>()).add(domain);
            }
        }
        for (ActivityAction action : ActivityAction.values()) {
            List<ActivityDomain> domains = owners.getOrDefault(action, List.of());
            assertEquals(1, domains.size(), action + " belongs to " + domains);
        }
    }

    @Test
    @DisplayName("Gửi nhắc nợ quá hạn nằm trong nhóm 'Quá hạn và niêm phong'")
    void overdueReminderIsInTheOverdueDomain() {
        assertTrue(ActivityDomain.OVERDUE.actions().contains(ActivityAction.OVERDUE_REMINDER_SENT));
    }

    @Test
    @DisplayName("Đăng nhập thành công không còn bị coi là 'quan trọng' (bộ lọc quan trọng không bị ngập); đăng nhập thất bại vẫn quan trọng")
    void routineSignInIsNotCritical() {
        assertFalse(ActivityAction.LOGIN_SUCCESS.isCritical());
        assertTrue(ActivityAction.LOGIN_FAILED.isCritical());
        assertFalse(ActivityAction.criticalActions().contains(ActivityAction.LOGIN_SUCCESS));
        assertTrue(ActivityAction.criticalActions().contains(ActivityAction.PASSWORD_CHANGE));
    }
}
