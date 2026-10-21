package com.boxora.util;

import com.boxora.enums.BookingStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BookingStatusLabelsTest {

    @Test
    @DisplayName("Mọi trạng thái đơn đều có tên tiếng Việt, không lộ mã enum")
    void everyStatusHasAVietnameseName() {
        for (BookingStatus status : BookingStatus.values()) {
            String label = BookingStatusLabels.of(status);
            assertThat(label).as(status.name()).isNotBlank().doesNotContain("_").isNotEqualToIgnoringCase(status.name());
            assertThat(label).as(status.name()).isEqualTo(label.toLowerCase());
        }
        assertThat(BookingStatusLabels.of(BookingStatus.CONFIRMED)).isEqualTo("đã xác nhận");
        assertThat(BookingStatusLabels.of(null)).isEqualTo("chưa xác định");
    }
}
