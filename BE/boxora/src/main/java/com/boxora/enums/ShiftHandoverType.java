package com.boxora.enums;

/**
 * Các loại bàn giao ca trực trong vận hành Boxora:
 * - ROUTINE: Bàn giao định kỳ khi đổi ca (ca trước chuyển ca tiếp theo)
 * - EMERGENCY: Bàn giao đột xuất (rời ca sớm, sức khỏe, khẩn cấp)
 * - RESPONSIBILITY_TRANSFER: Chuyển giao trách nhiệm nhiệm vụ trong cùng ca
 */
public enum ShiftHandoverType {
    ROUTINE,
    EMERGENCY,
    RESPONSIBILITY_TRANSFER
}
