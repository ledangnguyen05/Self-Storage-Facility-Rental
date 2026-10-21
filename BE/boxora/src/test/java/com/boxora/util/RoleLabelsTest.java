package com.boxora.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RoleLabelsTest {

    @Test
    @DisplayName("Mọi vai trò hệ thống có tên tiếng Việt, không lộ mã vai trò")
    void systemRolesHaveVietnameseNames() {
        assertThat(RoleLabels.of("ADMIN")).isEqualTo("Quản trị viên");
        assertThat(RoleLabels.of("BUSINESS_MANAGER")).isEqualTo("Giám đốc vận hành");
        assertThat(RoleLabels.of("FACILITY_MANAGER")).isEqualTo("Quản lý cơ sở");
        assertThat(RoleLabels.of("STAFF")).isEqualTo("Nhân viên");
        assertThat(RoleLabels.of("customer")).isEqualTo("Khách hàng");
    }

    @Test
    @DisplayName("Vai trò tùy chỉnh giữ nguyên tên, thiếu vai trò thì ghi chưa xác định")
    void customAndMissingRoles() {
        assertThat(RoleLabels.of("Kiểm toán nội bộ")).isEqualTo("Kiểm toán nội bộ");
        assertThat(RoleLabels.of(null)).isEqualTo("chưa xác định");
        assertThat(RoleLabels.of(" ")).isEqualTo("chưa xác định");
    }
}
