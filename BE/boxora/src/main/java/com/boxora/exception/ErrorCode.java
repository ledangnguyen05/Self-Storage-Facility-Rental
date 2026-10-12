package com.boxora.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {

    // ========================= ROLE (100 - 199) =========================
    ROLE_NOT_FOUND(100, "Role not found", HttpStatus.NOT_FOUND),
    ROLE_NAME_EXISTED(101, "Role name already exists", HttpStatus.BAD_REQUEST),
    CANNOT_DELETE_SYSTEM_ROLE(102, "Cannot delete default system role", HttpStatus.FORBIDDEN),
    CANNOT_MODIFY_SYSTEM_ROLE(103, "Cannot modify name of default system role", HttpStatus.FORBIDDEN),
    ROLE_IN_USE(104, "Cannot delete role because it is currently assigned to users", HttpStatus.CONFLICT),
    ROLE_INACTIVE(105, "Role is inactive", HttpStatus.BAD_REQUEST),

    // ========================= USER (200 - 299) =========================
    USER_NOT_FOUND(200, "User not found", HttpStatus.NOT_FOUND),
    USER_ALREADY_EXISTS(201, "Username already exists", HttpStatus.BAD_REQUEST),
    EMAIL_ALREADY_EXISTS(202, "Email already exists", HttpStatus.BAD_REQUEST),
    USER_INACTIVE(203, "User is inactive", HttpStatus.FORBIDDEN),

    // ========================= AUTH (300 - 399) =========================
    INVALID_CREDENTIALS(300, "Invalid email or password", HttpStatus.UNAUTHORIZED),
    UNAUTHORIZED(301, "Authentication is required", HttpStatus.UNAUTHORIZED),
    FORBIDDEN(302, "You do not have permission to access this resource", HttpStatus.FORBIDDEN),

    // ========================= TOKEN (400 - 499) =========================
    INVALID_TOKEN(400, "Invalid refresh token", HttpStatus.UNAUTHORIZED),
    TOKEN_EXPIRED(401, "Token has expired", HttpStatus.UNAUTHORIZED),
    TOKEN_REVOKED(402, "Token has been revoked", HttpStatus.UNAUTHORIZED),
    INVALID_REFRESH_TOKEN(403, "Invalid refresh token", HttpStatus.UNAUTHORIZED),

    // ========================= PASSWORD (500 - 599) =========================
    PASSWORD_MISMATCH(500, "Passwords do not match", HttpStatus.BAD_REQUEST),
    INVALID_OLD_PASSWORD(501, "Current password is incorrect", HttpStatus.BAD_REQUEST),
    NEW_PASSWORD_SAME_AS_OLD(502, "New password must be different from the old password", HttpStatus.BAD_REQUEST),
    INVALID_RESET_TOKEN(503, "Invalid or expired password reset token(refreshToken)", HttpStatus.BAD_REQUEST),

    // ========================= SYSTEM (600 - 699) =========================
    INTERNAL_SERVER_ERROR(600, "Internal server error", HttpStatus.INTERNAL_SERVER_ERROR),
    INVALID_REQUEST(601, "Invalid request", HttpStatus.BAD_REQUEST),
    RESOURCE_NOT_FOUND(602, "Resource not found", HttpStatus.NOT_FOUND),

    // ========================= BOOKING & ACCESS (700 - 799) =================
    BOOKING_NOT_FOUND(700, "Booking not found or does not belong to user", HttpStatus.NOT_FOUND),
    BOOKING_NOT_CHECKED_IN(701, "Storage unit has not been checked in yet", HttpStatus.FORBIDDEN),
    INVALID_PIN_FORMAT(702, "PIN must be exactly 6 digits", HttpStatus.BAD_REQUEST),
    UNIT_TYPE_NOT_FOUND(703, "Unit type not found", HttpStatus.NOT_FOUND),
    STORAGE_UNIT_NOT_FOUND(704, "Storage unit not found", HttpStatus.NOT_FOUND),
    INVALID_PRICING_TARGET(705, "Provide either unitTypeId or storageUnitId, but not both or neither", HttpStatus.BAD_REQUEST),
    UNIT_TYPE_PRICE_NOT_CONFIGURED(706, "Unit type monthly price is not configured", HttpStatus.INTERNAL_SERVER_ERROR),
    NO_AVAILABLE_UNIT(707, "No available storage unit found for the selected type and facility", HttpStatus.CONFLICT),
    STORAGE_UNIT_CODE_EXISTED(708, "Storage unit code already exists in this facility", HttpStatus.BAD_REQUEST),
    STORAGE_UNIT_IN_USE(709, "Cannot delete storage unit because it has active contracts or bookings", HttpStatus.CONFLICT),
    STORAGE_UNIT_CANNOT_MAINTAIN(710, "Cannot put storage unit into maintenance while it is occupied or reserved", HttpStatus.BAD_REQUEST),
    STORAGE_UNIT_NOT_AVAILABLE(711, "Storage unit is currently not available for booking", HttpStatus.CONFLICT),
    UNIT_TYPE_NAME_EXISTED(712, "Unit type name already exists", HttpStatus.BAD_REQUEST),
    UNIT_TYPE_IN_USE(713, "Cannot delete unit type because it is being used by existing storage units", HttpStatus.CONFLICT),
    BOOKING_ALREADY_CANCELLED(714, "Booking is already cancelled", HttpStatus.BAD_REQUEST),
    BOOKING_ALREADY_COMPLETED(715, "Completed booking cannot be cancelled", HttpStatus.BAD_REQUEST),
    BOOKING_CANNOT_BE_CANCELLED(716, "Booking cannot be cancelled in its current state", HttpStatus.BAD_REQUEST),
    BOOKING_START_DATE_PAST(717, "Start date cannot be in the past", HttpStatus.BAD_REQUEST),
    BOOKING_ADVANCE_NOTICE_EXCEEDED(718, "Storage unit can only be booked up to 30 days in advance", HttpStatus.BAD_REQUEST),
    STORAGE_UNIT_SOFT_LOCKED(719, "Storage unit is currently held in a 24-hour soft-lock reservation by another customer", HttpStatus.CONFLICT),
    BOOKING_MINIMUM_DURATION_INVALID(720, "Rental duration must meet minimum rental months requirement", HttpStatus.BAD_REQUEST),
    HANDOVER_PREREQUISITES_NOT_MET(721, "Không đủ 4 điều kiện bàn giao kho vật lý theo BR-RULE-005 (Cọc + Tiền thuê tháng đầu + Hợp đồng ký + Đối soát CCCD)", HttpStatus.BAD_REQUEST),
    HANDOVER_UNIT_NOT_READY(722, "Ngăn kho không ở trạng thái sẵn sàng để bàn giao theo BR-RULE-006", HttpStatus.CONFLICT),
    HANDOVER_ALREADY_ACTIVE(723, "Đơn đặt kho đã được check-in bàn giao trước đó", HttpStatus.BAD_REQUEST),
    RETURN_INSPECTION_CHECKLIST_INCOMPLETE(724, "Chưa hoàn tất đầy đủ 5 tiêu chuẩn kiểm tra hiện trạng trả kho theo BR-RULE-013", HttpStatus.BAD_REQUEST),
    BOOKING_NOT_ACTIVE_FOR_RETURN(725, "Đơn đặt kho phải ở trạng thái đang hoạt động (ACTIVE) mới được thực hiện trả kho", HttpStatus.BAD_REQUEST),
    RETURN_PHOTO_EVIDENCE_REQUIRED(726, "Cần tối thiểu 2 ảnh chụp hiện trường để xác nhận nghiệm thu trả kho theo BR-RULE-013", HttpStatus.BAD_REQUEST),
    BOOKING_PAYMENT_EXPIRED(727, "The 24-hour booking payment window has expired", HttpStatus.CONFLICT),

    // ========================= PAYMENT (750 - 799) =========================
    PAYMENT_NOT_FOUND(750, "Payment transaction not found", HttpStatus.NOT_FOUND),
    PAYMENT_ALREADY_PROCESSED(751, "Payment has already been processed", HttpStatus.CONFLICT),
    INVALID_PAYMENT_SIGNATURE(752, "Invalid VNPay payment signature", HttpStatus.BAD_REQUEST),
    PAYMENT_AMOUNT_MISMATCH(753, "Payment amount does not match booking requirement", HttpStatus.BAD_REQUEST),
    PAYMENT_FAILED(754, "Payment transaction failed or was cancelled", HttpStatus.BAD_REQUEST),

    // ========================= ROLE_PERMISSION (800 - 899) =========================
    ROLE_PERMISSION_NOT_FOUND(800, "Role-permission mapping not found", HttpStatus.NOT_FOUND),
    ROLE_PERMISSION_ALREADY_EXISTS(801, "This permission is already assigned to the role", HttpStatus.BAD_REQUEST),

    // ========================= PERMISSION (900 - 999) =========================
    PERMISSION_NOT_FOUND(900, "Permission not found", HttpStatus.NOT_FOUND),
    PERMISSION_NAME_EXISTED(901, "Permission name already exists", HttpStatus.BAD_REQUEST),
    PERMISSION_GROUP_EXISTED(902, "Permission group already exists", HttpStatus.BAD_REQUEST),
    PERMISSION_IN_USE(903, "Cannot delete permission because it is currently assigned to roles", HttpStatus.CONFLICT),
    PERMISSION_INACTIVE(904, "Permission is inactive", HttpStatus.BAD_REQUEST),

    // ========================= FACILITY (1000 - 1099) =========================
    FACILITY_NOT_FOUND(1000, "Facility not found", HttpStatus.NOT_FOUND),
    FACILITY_CODE_EXISTED(1001, "Facility code already exists", HttpStatus.BAD_REQUEST),
    INVALID_MANAGER_TO_ASSIGN(1002,"Invalid manager to assign for this facility",HttpStatus.BAD_REQUEST),
    FACILITY_ACCESS_DENIED(1003, "You do not have access to this facility's data", HttpStatus.FORBIDDEN),

    // ========================= FACILITY_POLICY (1100 - 1199) =========================
    FACILITY_POLICY_NOT_FOUND(1100, "Facility policy not found", HttpStatus.NOT_FOUND),
    FACILITY_POLICY_ALREADY_EXISTS(1101, "This facility already has a policy configured", HttpStatus.BAD_REQUEST),
    FACILITY_POLICY_INVALID_CANCELLATION(1102, "Cancellation full refund hours must be greater than or equal to partial refund hours", HttpStatus.BAD_REQUEST),

    // ========================= SUPPORT_TICKET (1200 - 1299) =========================
    TICKET_NOT_FOUND(1200, "Support ticket not found or does not belong to user", HttpStatus.NOT_FOUND),
    TICKET_IMAGE_UPLOAD_FAILED(1201, "Tải tệp tin ảnh bằng chứng thất bại", HttpStatus.INTERNAL_SERVER_ERROR),
    TICKET_INVALID_IMAGE_FORMAT(1202, "Định dạng tệp không hợp lệ. Chỉ chấp nhận ảnh JPG, PNG, WEBP, GIF", HttpStatus.BAD_REQUEST),
    TICKET_IMAGE_SIZE_EXCEEDED(1203, "Kích thước tệp ảnh vượt quá giới hạn cho phép (10MB)", HttpStatus.BAD_REQUEST),

    // ========================= ACTIVITY_LOG (1300 - 1399) =========================
    ACTIVITY_LOG_NOT_FOUND(1300, "Activity log entry not found", HttpStatus.NOT_FOUND),

    // ========================= MASTER_KEY (1400 - 1499) =========================
    MASTER_KEY_OVERRIDE_NOT_FOUND(1400, "Master key override record not found", HttpStatus.NOT_FOUND),
    MASTER_KEY_WITNESS_REQUIRED(1401, "Witness must be a different user from the person performing the override", HttpStatus.BAD_REQUEST),
    MASTER_KEY_WITNESS_NOT_FOUND(1402, "Witness user not found", HttpStatus.NOT_FOUND),
    MASTER_KEY_WITNESS_WRONG_FACILITY(1403, "Witness must belong to the same facility", HttpStatus.BAD_REQUEST),
    MASTER_KEY_WITNESS_INVALID_CREDENTIALS(1404, "Witness credentials verification failed", HttpStatus.UNAUTHORIZED),
    MASTER_KEY_WITNESS_INACTIVE(1405, "Witness user account is inactive or disabled", HttpStatus.BAD_REQUEST),
    MASTER_KEY_WITNESS_UNAUTHORIZED_ROLE(1406, "Witness must be a staff member or manager", HttpStatus.FORBIDDEN),
    MASTER_KEY_RESOURCE_WRONG_FACILITY(1407, "Target storage unit does not belong to the specified facility", HttpStatus.BAD_REQUEST),

    // ========================= CONTRACT & RENEWAL (1500 - 1599) =========================
    CONTRACT_NOT_FOUND(1500, "Rental contract not found", HttpStatus.NOT_FOUND),
    CONTRACT_SIGNING_FAILED(1501, "Failed to create e-contract signing request", HttpStatus.INTERNAL_SERVER_ERROR),
    CONTRACT_SIGNING_INVALID_WEBHOOK_TOKEN(1502, "Invalid webhook token", HttpStatus.UNAUTHORIZED),
    CONTRACT_ALREADY_SIGNED(1503, "Contract is already signed", HttpStatus.BAD_REQUEST),
    CONTRACT_NOT_ACTIVE(1504, "Contract is not active", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_WINDOW_CLOSED(1505, "Contract renewal is only allowed within the renewal window before expiration", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_NOT_FOUND(1506, "Contract renewal request not found", HttpStatus.NOT_FOUND),
    CONTRACT_RENEWAL_ALREADY_COMPLETED(1507, "Contract renewal has already been completed", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_ALREADY_SIGNED(1508, "Contract renewal is already signed", HttpStatus.BAD_REQUEST),
    RENEWAL_CONTRACT_NOT_FOUND(1509, "Rental contract not found", HttpStatus.NOT_FOUND),
    CONTRACT_OTP_NOT_FOUND(1510, "No active contract OTP request was found", HttpStatus.BAD_REQUEST),
    CONTRACT_OTP_INVALID(1511, "The contract OTP is invalid or has expired", HttpStatus.BAD_REQUEST),
    CONTRACT_OTP_RESEND_TOO_SOON(1512, "Please wait before requesting another contract OTP", HttpStatus.TOO_MANY_REQUESTS),
    CONTRACT_OTP_ALREADY_VERIFIED(1513, "The contract OTP has already been verified", HttpStatus.BAD_REQUEST),
    CONTRACT_OTP_ATTEMPTS_EXCEEDED(1514, "Too many invalid contract OTP attempts", HttpStatus.TOO_MANY_REQUESTS),

    // ========================= PRICE & PRICE HISTORY (BR-RULE-011) (1600 - 1699) =========================
    PRICE_MUST_BE_GREATER_THAN_ZERO(1600, "Price must be greater than zero", HttpStatus.BAD_REQUEST),
    PRICE_UNCHANGED(1601, "New price must be different from current price", HttpStatus.BAD_REQUEST),
    PRICE_ADJUSTMENT_REASON_REQUIRED(1602, "Reason for price adjustment is mandatory under BR-RULE-011", HttpStatus.BAD_REQUEST),
    PRICE_EFFECTIVE_DATE_INVALID(1603, "Effective date cannot be more than 1 day in the past", HttpStatus.BAD_REQUEST),
    PRICE_HISTORY_NOT_FOUND(1604, "Storage unit price history not found", HttpStatus.NOT_FOUND),

    // ========================= STAFF_ASSIGNMENT (1700 - 1799) =========================
    STAFF_ASSIGNMENT_NOT_FOUND(1700, "Staff assignment not found", HttpStatus.NOT_FOUND),
    STAFF_USER_NOT_FOUND(1701, "Staff user not found", HttpStatus.NOT_FOUND),
    USER_NOT_A_STAFF(1702, "The selected user is not a staff member", HttpStatus.BAD_REQUEST),
    STAFF_ALREADY_ASSIGNED_SHIFT(1703, "Staff member is already assigned to this shift on the specified date", HttpStatus.CONFLICT),
    STAFF_ASSIGNMENT_FACILITY_MISMATCH(1704, "Staff member does not belong to the selected facility", HttpStatus.BAD_REQUEST),
    INVALID_ASSIGNMENT_DATE(1705, "Assignment date cannot be in the past", HttpStatus.BAD_REQUEST),

    // ========================= SEALING & OVERDUE (BR-RULE-012) (1800 - 1899) =========================
    SEALING_RECORD_NOT_FOUND(1800, "Sealing record not found", HttpStatus.NOT_FOUND),
    SEALING_ALREADY_SEALED(1801, "Storage unit is already sealed", HttpStatus.BAD_REQUEST),
    SEALING_ALREADY_UNSEALED(1802, "Storage unit is already unsealed", HttpStatus.BAD_REQUEST),
    SEALING_WITNESS_REQUIRED(1803, "Witness is mandatory for sealing/unsealing under BR-RULE-012", HttpStatus.BAD_REQUEST),

    // ========================= FEE_TYPE (1900 - 1949) =========================
    FEE_TYPE_NOT_FOUND(1900, "Fee type not found", HttpStatus.NOT_FOUND),
    FEE_TYPE_CODE_EXISTS(1901, "Fee type code already exists", HttpStatus.CONFLICT),
    FEE_TYPE_AMOUNT_INVALID(1902, "Fee type default amount must be non-negative", HttpStatus.BAD_REQUEST),

    // ========================= DISCOUNT (1950 - 1999) =========================
    DISCOUNT_NOT_FOUND(1950, "Discount not found", HttpStatus.NOT_FOUND),
    DISCOUNT_CODE_EXISTS(1951, "Discount code already exists", HttpStatus.CONFLICT),
    DISCOUNT_EXPIRED(1952, "Discount code is expired or not yet active", HttpStatus.BAD_REQUEST),
    DISCOUNT_USAGE_LIMIT_EXCEEDED(1953, "Discount code has reached its maximum usage limit", HttpStatus.BAD_REQUEST),
    DISCOUNT_MIN_MONTHS_NOT_MET(1954, "Rental period does not meet minimum duration required for this discount", HttpStatus.BAD_REQUEST),
    DISCOUNT_FACILITY_MISMATCH(1955, "Discount code is not applicable to this facility", HttpStatus.BAD_REQUEST),
    DISCOUNT_VALUE_INVALID(1956, "Discount value is invalid", HttpStatus.BAD_REQUEST),
    DISCOUNT_DATE_INVALID(1957, "End date cannot be earlier than start date", HttpStatus.BAD_REQUEST),

    // ========================= RESTORED PAYMENT / SEALING / REFUND / NOTIFICATION =========================
    PAYMENT_TARGET_REQUIRED(755, "Vui lòng cung cấp bookingId hoặc contractId hợp lệ để khởi tạo thanh toán", HttpStatus.BAD_REQUEST),
    UNIT_ALREADY_SEALED(1810, "Kho lưu trữ này hiện đang trong trạng thái niêm phong", HttpStatus.BAD_REQUEST),
    UNIT_NOT_SEALED(1811, "Kho lưu trữ này không ở trạng thái niêm phong", HttpStatus.BAD_REQUEST),
    UNIT_OVERDUE_LOCKED(1812, "Kho đang bị niêm phong khóa cưỡng chế do quá hạn thanh toán. Vui lòng thanh toán công nợ", HttpStatus.FORBIDDEN),
    REFUND_REQUEST_NOT_FOUND(2000, "Yêu cầu hoàn tiền không tồn tại", HttpStatus.NOT_FOUND),
    REFUND_ALREADY_REVIEWED(2001, "Yêu cầu hoàn tiền đã được xem xét/phê duyệt trước đó", HttpStatus.BAD_REQUEST),
    REFUND_ALREADY_PROCESSED(2002, "Yêu cầu hoàn tiền đã được xử lý chi trả hoàn tất", HttpStatus.BAD_REQUEST),
    REFUND_NOT_APPROVED(2003, "Yêu cầu hoàn tiền phải được phê duyệt trước khi xử lý chi trả", HttpStatus.BAD_REQUEST),
    INVALID_REFUND_AMOUNT(2004, "Số tiền hoàn không hợp lệ", HttpStatus.BAD_REQUEST),
    REFUND_TARGET_REQUIRED(2005, "Vui lòng cung cấp bookingId hoặc contractId hợp lệ cho yêu cầu hoàn tiền", HttpStatus.BAD_REQUEST),
    NOTIFICATION_NOT_FOUND(2100, "Bản ghi thông báo không tồn tại", HttpStatus.NOT_FOUND);




    private final int code;
    private final String message;
    private final HttpStatus httpStatus;

    ErrorCode(int code, String message, HttpStatus httpStatus) {
        this.code = code;
        this.message = message;
        this.httpStatus = httpStatus;
    }
}
