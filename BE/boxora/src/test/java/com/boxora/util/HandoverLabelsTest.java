package com.boxora.util;

import com.boxora.enums.PaymentType;
import com.boxora.enums.RentalContractStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class HandoverLabelsTest {

    @Test
    @DisplayName("Loại thanh toán và trạng thái hợp đồng đều có tên tiếng Việt, không lộ mã enum")
    void enumsHaveVietnameseNames() {
        for (PaymentType type : PaymentType.values()) {
            assertThat(HandoverLabels.paymentType(type)).as(type.name()).isNotBlank().doesNotContain("_");
        }
        for (RentalContractStatus status : RentalContractStatus.values()) {
            assertThat(HandoverLabels.contractStatus(status)).as(status.name()).isNotBlank().doesNotContain("_");
        }
        assertThat(HandoverLabels.paymentType(PaymentType.DEPOSIT)).isEqualTo("tiền cọc");
        assertThat(HandoverLabels.contractStatus(RentalContractStatus.PENDING_SIGNATURE)).isEqualTo("chờ ký");
    }

    @Test
    @DisplayName("Phương thức thanh toán, trạng thái duyệt hoàn tiền và công nợ được dịch")
    void codesAreTranslated() {
        assertThat(HandoverLabels.paymentMethod("CASH")).isEqualTo("tiền mặt");
        assertThat(HandoverLabels.paymentMethod("BANK_TRANSFER")).isEqualTo("chuyển khoản");
        assertThat(HandoverLabels.refundReviewStatus("PENDING_ACCOUNTING_REVIEW")).isEqualTo("chờ kế toán duyệt");
        assertThat(HandoverLabels.refundReviewStatus("AUTO_REFUND_APPROVED")).isEqualTo("tự động duyệt hoàn tiền");
        assertThat(HandoverLabels.debtStatus("WRITTEN_OFF")).isEqualTo("đã xóa nợ");
        assertThat(HandoverLabels.debtStatus("COLLECTED")).isEqualTo("đã thu");
        assertThat(HandoverLabels.paymentMethod(null)).isEqualTo("chưa xác định");
    }

    @Test
    @DisplayName("Loại giấy tờ hiển thị bằng tiếng Việt")
    void identityTypeLabel() {
        assertThat(IdentityDocuments.label("PASSPORT")).isEqualTo("Hộ chiếu");
        assertThat(IdentityDocuments.label("cccd")).isEqualTo("CCCD");
        assertThat(IdentityDocuments.label(null)).isEqualTo("CCCD");
    }
}
