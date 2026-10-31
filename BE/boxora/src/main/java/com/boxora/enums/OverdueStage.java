package com.boxora.enums;

public enum OverdueStage {
    GRACE_PERIOD,          // Nhóm 1: Ân hạn nhắc cước (overdueDays = 1)
    WARNING,               // Nhóm 2: Cảnh báo (overdueDays = 2)
    PIN_REVOCATION,        // Nhóm 3: Đạt ngưỡng thu hồi PIN/QR (3 <= overdueDays < 7)
    SEALING_ELIGIBLE,      // Nhóm 4: Đủ điều kiện niêm phong & xử lý tài sản (overdueDays >= 7)
    POLICY_UNCONFIGURED    // Nhóm 5: Thiếu chính sách hoặc chính sách không hợp lệ
}
