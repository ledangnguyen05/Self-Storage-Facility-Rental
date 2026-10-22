package com.boxora.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {

    // ========================= ROLE (100 - 199) =========================
    ROLE_NOT_FOUND(100, "Không tìm thấy vai trò người dùng", HttpStatus.NOT_FOUND),
    ROLE_NAME_EXISTED(101, "Tên vai trò đã tồn tại trong hệ thống", HttpStatus.BAD_REQUEST),
    CANNOT_DELETE_SYSTEM_ROLE(102, "Không thể xóa vai trò mặc định của hệ thống", HttpStatus.FORBIDDEN),
    CANNOT_MODIFY_SYSTEM_ROLE(103, "Không thể chỉnh sửa vai trò mặc định của hệ thống", HttpStatus.FORBIDDEN),
    ROLE_IN_USE(104, "Không thể xóa vai trò vì đang được gán cho người dùng", HttpStatus.CONFLICT),
    ROLE_INACTIVE(105, "Vai trò hiện đang bị vô hiệu hóa", HttpStatus.BAD_REQUEST),

    // ========================= USER (200 - 299) =========================
    USER_NOT_FOUND(200, "Không tìm thấy thông tin người dùng", HttpStatus.NOT_FOUND),
    USER_ALREADY_EXISTS(201, "Tên đăng nhập đã tồn tại trong hệ thống", HttpStatus.BAD_REQUEST),
    EMAIL_ALREADY_EXISTS(202, "Email này đã được đăng ký tài khoản", HttpStatus.BAD_REQUEST),
    USER_INACTIVE(203, "Tài khoản của bạn đã bị khóa hoặc chưa kích hoạt", HttpStatus.FORBIDDEN),

    // ========================= AUTH (300 - 399) =========================
    INVALID_CREDENTIALS(300, "Email hoặc mật khẩu không chính xác", HttpStatus.UNAUTHORIZED),
    UNAUTHORIZED(301, "Vui lòng đăng nhập để thực hiện thao tác này", HttpStatus.UNAUTHORIZED),
    FORBIDDEN(302, "Bạn không có quyền thực hiện thao tác hoặc truy cập tài nguyên này", HttpStatus.FORBIDDEN),
    INVALID_CAPTCHA(303, "Mã xác thực Captcha không chính xác hoặc đã hết hạn", HttpStatus.BAD_REQUEST),
    CAPTCHA_REQUIRED(304, "Vui lòng nhập mã xác thực Captcha để chống bot tự động", HttpStatus.BAD_REQUEST),
    INVALID_GOOGLE_TOKEN(305, "Mã xác thực Google không hợp lệ hoặc đã hết hạn", HttpStatus.UNAUTHORIZED),
    GOOGLE_ACCOUNT_NOT_REGISTERED(306, "Tài khoản Google này chưa được đăng ký trong hệ thống Boxora. Vui lòng đăng ký tài khoản trước.", HttpStatus.NOT_FOUND),

    // ========================= TOKEN (400 - 499) =========================
    INVALID_TOKEN(400, "Mã token xác thực không hợp lệ", HttpStatus.UNAUTHORIZED),
    TOKEN_EXPIRED(401, "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại", HttpStatus.UNAUTHORIZED),
    TOKEN_REVOKED(402, "Mã token đã bị thu hồi", HttpStatus.UNAUTHORIZED),
    INVALID_REFRESH_TOKEN(403, "Mã làm mới phiên đăng nhập không hợp lệ hoặc đã hết hạn", HttpStatus.UNAUTHORIZED),

    // ========================= PASSWORD (500 - 599) =========================
    PASSWORD_MISMATCH(500, "Mật khẩu xác nhận không khớp với mật khẩu mới", HttpStatus.BAD_REQUEST),
    INVALID_OLD_PASSWORD(501, "Mật khẩu hiện tại không chính xác", HttpStatus.BAD_REQUEST),
    NEW_PASSWORD_SAME_AS_OLD(502, "Mật khẩu mới không được trùng với mật khẩu hiện tại", HttpStatus.BAD_REQUEST),
    INVALID_RESET_TOKEN(503, "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn", HttpStatus.BAD_REQUEST),

    // ========================= SYSTEM (600 - 699) =========================
    INTERNAL_SERVER_ERROR(600, "Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau", HttpStatus.INTERNAL_SERVER_ERROR),
    INVALID_REQUEST(601, "Yêu cầu không hợp lệ hoặc dữ liệu gửi lên bị thiếu", HttpStatus.BAD_REQUEST),
    RESOURCE_NOT_FOUND(602, "Không tìm thấy tài nguyên yêu cầu", HttpStatus.NOT_FOUND),

    // ========================= BOOKING & ACCESS (700 - 799) =================
    BOOKING_NOT_FOUND(700, "Không tìm thấy đơn đặt kho hoặc đơn không thuộc về tài khoản của bạn", HttpStatus.NOT_FOUND),
    BOOKING_NOT_CHECKED_IN(701, "Ngăn kho chưa hoàn tất thủ tục bàn giao nhận kho (check-in)", HttpStatus.FORBIDDEN),
    INVALID_PIN_FORMAT(702, "Mã PIN mở khóa phải bao gồm đúng 6 chữ số", HttpStatus.BAD_REQUEST),
    UNIT_TYPE_NOT_FOUND(703, "Không tìm thấy loại ngăn kho", HttpStatus.NOT_FOUND),
    STORAGE_UNIT_NOT_FOUND(704, "Không tìm thấy thông tin ngăn kho", HttpStatus.NOT_FOUND),
    INVALID_PRICING_TARGET(705, "Vui lòng chọn loại ngăn kho hoặc mã ngăn kho cụ thể", HttpStatus.BAD_REQUEST),
    UNIT_TYPE_PRICE_NOT_CONFIGURED(706, "Chưa thiết lập giá thuê theo tháng cho loại ngăn kho này", HttpStatus.INTERNAL_SERVER_ERROR),
    NO_AVAILABLE_UNIT(707, "Không còn ngăn kho trống phù hợp tại cơ sở đã chọn", HttpStatus.CONFLICT),
    STORAGE_UNIT_CODE_EXISTED(708, "Mã ngăn kho này đã tồn tại tại cơ sở", HttpStatus.BAD_REQUEST),
    STORAGE_UNIT_IN_USE(709, "Không thể xóa ngăn kho vì đang có hợp đồng hoặc lịch đặt hoạt động", HttpStatus.CONFLICT),
    STORAGE_UNIT_CANNOT_MAINTAIN(710, "Không thể chuyển ngăn kho sang bảo trì khi đang có khách thuê hoặc đặt chỗ", HttpStatus.BAD_REQUEST),
    STORAGE_UNIT_NOT_AVAILABLE(711, "Ngăn kho hiện không khả dụng để đặt chỗ", HttpStatus.CONFLICT),
    UNIT_TYPE_NAME_EXISTED(712, "Tên loại ngăn kho đã tồn tại", HttpStatus.BAD_REQUEST),
    UNIT_TYPE_IN_USE(713, "Không thể xóa loại ngăn kho vì đang có các ngăn kho thuộc loại này", HttpStatus.CONFLICT),
    BOOKING_ALREADY_CANCELLED(714, "Đơn đặt kho đã được hủy trước đó", HttpStatus.BAD_REQUEST),
    BOOKING_ALREADY_COMPLETED(715, "Đơn đặt kho đã hoàn tất, không thể hủy", HttpStatus.BAD_REQUEST),
    BOOKING_CANNOT_BE_CANCELLED(716, "Đơn đặt kho không thể hủy ở trạng thái hiện tại", HttpStatus.BAD_REQUEST),
    BOOKING_START_DATE_PAST(717, "Ngày bắt đầu thuê không được là ngày trong quá khứ", HttpStatus.BAD_REQUEST),
    BOOKING_ADVANCE_NOTICE_EXCEEDED(718, "Chỉ có thể đặt trước ngăn kho tối đa 30 ngày", HttpStatus.BAD_REQUEST),
    STORAGE_UNIT_SOFT_LOCKED(719, "Ngăn kho hiện đang được giữ chỗ tạm thời (24h) bởi khách hàng khác", HttpStatus.CONFLICT),
    BOOKING_MINIMUM_DURATION_INVALID(720, "Thời hạn thuê phải đáp ứng số tháng thuê tối thiểu quy định", HttpStatus.BAD_REQUEST),
    HANDOVER_PREREQUISITES_NOT_MET(721, "Không đủ 4 điều kiện bàn giao kho vật lý theo BR-RULE-005 (Cọc + Tiền thuê tháng đầu + Hợp đồng ký + Đối soát CCCD)", HttpStatus.BAD_REQUEST),
    HANDOVER_UNIT_NOT_READY(722, "Ngăn kho không ở trạng thái sẵn sàng để bàn giao theo BR-RULE-006", HttpStatus.CONFLICT),
    HANDOVER_ALREADY_ACTIVE(723, "Đơn đặt kho đã được check-in bàn giao trước đó", HttpStatus.BAD_REQUEST),
    RETURN_INSPECTION_CHECKLIST_INCOMPLETE(724, "Chưa hoàn tất đầy đủ 5 tiêu chuẩn kiểm tra hiện trạng trả kho theo BR-RULE-013", HttpStatus.BAD_REQUEST),
    BOOKING_NOT_ACTIVE_FOR_RETURN(725, "Đơn đặt kho phải ở trạng thái đang hoạt động (ACTIVE) mới được thực hiện trả kho", HttpStatus.BAD_REQUEST),
    RETURN_PHOTO_EVIDENCE_REQUIRED(726, "Cần tối thiểu 2 ảnh chụp hiện trường để xác nhận nghiệm thu trả kho theo BR-RULE-013", HttpStatus.BAD_REQUEST),
    BOOKING_PAYMENT_EXPIRED(727, "Thời hạn 24h thanh toán đơn đặt kho đã hết hạn", HttpStatus.CONFLICT),
    BOOKING_REQUEST_NOT_PENDING_APPROVAL(728, "Yêu cầu thuê kho không còn ở trạng thái chờ duyệt", HttpStatus.CONFLICT),
    BOOKING_ALREADY_ACTIVE(729, "Đơn đặt kho đã kích hoạt và đang sử dụng, không thể đổi lịch", HttpStatus.BAD_REQUEST),
    BOOKING_ALREADY_HANDED_OVER(730, "Kho đã được bàn giao thực tế, không thể đổi lịch nhận kho", HttpStatus.BAD_REQUEST),
    HANDOVER_BEFORE_CHECKIN_DATE(731, "Chưa đến ngày check-in. Thời điểm được phép nhận kho chưa tới.", HttpStatus.BAD_REQUEST),
    HANDOVER_BEFORE_CHECKIN_TIME(732, "Đúng ngày nhưng chưa đến giờ check-in hẹn trước. Vui lòng chờ đến giờ hợp lệ.", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_BEFORE_CHECKIN_DATE(733, "Chưa đến ngày hẹn check-in tiếp đón gia hạn hợp đồng tại cơ sở.", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_BEFORE_CHECKIN_TIME(734, "Đúng ngày nhưng chưa đến giờ hẹn tiếp đón gia hạn hợp đồng. Vui lòng chờ đến giờ hợp lệ.", HttpStatus.BAD_REQUEST),

    // ========================= PAYMENT (750 - 799) =========================
    PAYMENT_NOT_FOUND(750, "Không tìm thấy giao dịch thanh toán", HttpStatus.NOT_FOUND),
    PAYMENT_ALREADY_PROCESSED(751, "Giao dịch thanh toán đã được xử lý trước đó", HttpStatus.CONFLICT),
    INVALID_PAYMENT_SIGNATURE(752, "Chữ ký bảo mật giao dịch VNPay không hợp lệ", HttpStatus.BAD_REQUEST),
    PAYMENT_AMOUNT_MISMATCH(753, "Số tiền thanh toán không khớp với số tiền yêu cầu", HttpStatus.BAD_REQUEST),
    PAYMENT_FAILED(754, "Giao dịch thanh toán thất bại hoặc đã bị hủy", HttpStatus.BAD_REQUEST),
    PAYMENT_AMOUNT_INVALID(755, "Số tiền thanh toán không hợp lệ (phải lớn hơn 0đ)", HttpStatus.BAD_REQUEST),

    // ========================= ROLE_PERMISSION (800 - 899) =========================
    ROLE_PERMISSION_NOT_FOUND(800, "Không tìm thấy liên kết vai trò và quyền hạn", HttpStatus.NOT_FOUND),
    ROLE_PERMISSION_ALREADY_EXISTS(801, "Quyền hạn này đã được gán cho vai trò", HttpStatus.BAD_REQUEST),

    // ========================= PERMISSION (900 - 999) =========================
    PERMISSION_NOT_FOUND(900, "Không tìm thấy quyền hạn", HttpStatus.NOT_FOUND),
    PERMISSION_NAME_EXISTED(901, "Tên quyền hạn đã tồn tại trong hệ thống", HttpStatus.BAD_REQUEST),
    PERMISSION_GROUP_EXISTED(902, "Nhóm quyền hạn đã tồn tại trong hệ thống", HttpStatus.BAD_REQUEST),
    PERMISSION_INUSE(903, "Không thể xóa quyền hạn vì đang được gán cho các vai trò", HttpStatus.CONFLICT),
    PERMISSION_INACTIVE(904, "Quyền hạn hiện đang bị vô hiệu hóa", HttpStatus.BAD_REQUEST),

    // ========================= FACILITY (1000 - 1099) =========================
    FACILITY_NOT_FOUND(1000, "Không tìm thấy thông tin cơ sở kho", HttpStatus.NOT_FOUND),
    FACILITY_CODE_EXISTED(1001, "Mã cơ sở kho đã tồn tại trong hệ thống", HttpStatus.BAD_REQUEST),
    INVALID_MANAGER_TO_ASSIGN(1002, "Người quản lý được chỉ định không hợp lệ cho cơ sở này", HttpStatus.BAD_REQUEST),
    FACILITY_ACCESS_DENIED(1003, "Bạn không có quyền truy cập dữ liệu của cơ sở này", HttpStatus.FORBIDDEN),
    FACILITY_INACTIVE(1004, "Cơ sở lưu trữ này hiện đang tạm ngưng hoạt động, không thể thực hiện đặt giữ chỗ mới", HttpStatus.BAD_REQUEST),
    FACILITY_UNDER_MAINTENANCE(1005, "Cơ sở lưu trữ này hiện đang bảo trì kỹ thuật, không thể thực hiện đặt giữ chỗ mới", HttpStatus.BAD_REQUEST),

    // ========================= FACILITY_POLICY (1100 - 1199) =========================
    FACILITY_POLICY_NOT_FOUND(1100, "Không tìm thấy chính sách cơ sở kho", HttpStatus.NOT_FOUND),
    FACILITY_POLICY_ALREADY_EXISTS(1101, "Cơ sở này đã được thiết lập chính sách", HttpStatus.BAD_REQUEST),
    FACILITY_POLICY_INVALID_CANCELLATION(1102, "Thời gian hoàn 100% khi hủy phải lớn hơn hoặc bằng thời gian hoàn một phần", HttpStatus.BAD_REQUEST),
    FACILITY_POLICY_INVALID_PRICES(1103, "Mỗi loại ngăn kho chỉ có một mức giá trong chính sách cơ sở", HttpStatus.BAD_REQUEST),

    // ========================= SUPPORT_TICKET (1200 - 1299) =========================
    TICKET_NOT_FOUND(1200, "Phiếu sự cố không tồn tại hoặc không thuộc quyền quản lý của bạn", HttpStatus.NOT_FOUND),
    TICKET_IMAGE_UPLOAD_FAILED(1201, "Tải tệp tin ảnh bằng chứng thất bại", HttpStatus.INTERNAL_SERVER_ERROR),
    TICKET_INVALID_IMAGE_FORMAT(1202, "Định dạng tệp không hợp lệ. Chỉ chấp nhận ảnh JPG, PNG, WEBP, GIF", HttpStatus.BAD_REQUEST),
    TICKET_IMAGE_SIZE_EXCEEDED(1203, "Kích thước tệp ảnh vượt quá giới hạn cho phép (10MB)", HttpStatus.BAD_REQUEST),
    TICKET_INVALID_STATUS_TRANSITION(1204, "Chuyển trạng thái sự cố không hợp lệ theo quy trình", HttpStatus.BAD_REQUEST),
    TICKET_FACILITY_MISMATCH(1205, "Không có quyền thao tác trên sự cố ngoài phạm vi cơ sở được phân công", HttpStatus.FORBIDDEN),
    TICKET_STAFF_NOT_IN_FACILITY(1206, "Nhân viên được phân công không thuộc cơ sở này", HttpStatus.BAD_REQUEST),
    TICKET_ALREADY_CLOSED(1207, "Phiếu sự cố đã được đóng hoàn tất", HttpStatus.BAD_REQUEST),
    TICKET_UNIT_NOT_IN_FACILITY(1208, "Mã ngăn kho không tồn tại hoặc không thuộc cơ sở xảy ra sự cố", HttpStatus.BAD_REQUEST),

    // ========================= ACTIVITY_LOG (1300 - 1399) =========================
    ACTIVITY_LOG_NOT_FOUND(1300, "Không tìm thấy bản ghi nhật ký hoạt động", HttpStatus.NOT_FOUND),

    // ========================= MASTER_KEY (1400 - 1499) =========================
    MASTER_KEY_OVERRIDE_NOT_FOUND(1400, "Không tìm thấy bản ghi mở khóa khẩn cấp Master Key", HttpStatus.NOT_FOUND),
    MASTER_KEY_WITNESS_REQUIRED(1401, "Người làm chứng phải là người khác với người thực hiện mở khóa", HttpStatus.BAD_REQUEST),
    MASTER_KEY_WITNESS_NOT_FOUND(1402, "Không tìm thấy thông tin người làm chứng", HttpStatus.NOT_FOUND),
    MASTER_KEY_WITNESS_WRONG_FACILITY(1403, "Người làm chứng phải thuộc cùng cơ sở với ngăn kho", HttpStatus.BAD_REQUEST),
    MASTER_KEY_WITNESS_INVALID_CREDENTIALS(1404, "Xác thực mật khẩu người làm chứng thất bại", HttpStatus.UNAUTHORIZED),
    MASTER_KEY_WITNESS_INACTIVE(1405, "Tài khoản người làm chứng đã bị khóa hoặc chưa kích hoạt", HttpStatus.BAD_REQUEST),
    MASTER_KEY_WITNESS_UNAUTHORIZED_ROLE(1406, "Người làm chứng phải là nhân viên hoặc quản lý cơ sở", HttpStatus.FORBIDDEN),
    MASTER_KEY_RESOURCE_WRONG_FACILITY(1407, "Ngăn kho mục tiêu không thuộc cơ sở được chỉ định", HttpStatus.BAD_REQUEST),

    // ========================= CONTRACT & RENEWAL (1500 - 1599) =========================
    CONTRACT_NOT_FOUND(1500, "Không tìm thấy hợp đồng thuê kho", HttpStatus.NOT_FOUND),
    CONTRACT_SIGNING_FAILED(1501, "Khởi tạo yêu cầu ký hợp đồng điện tử thất bại", HttpStatus.INTERNAL_SERVER_ERROR),
    CONTRACT_SIGNING_INVALID_WEBHOOK_TOKEN(1502, "Mã webhook xác thực ký hợp đồng không hợp lệ", HttpStatus.UNAUTHORIZED),
    CONTRACT_ALREADY_SIGNED(1503, "Hợp đồng đã được ký hoàn tất", HttpStatus.BAD_REQUEST),
    CONTRACT_NOT_ACTIVE(1504, "Hợp đồng hiện không ở trạng thái hoạt động", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_WINDOW_CLOSED(1505, "Chỉ được phép gia hạn hợp đồng trong khung thời gian cho phép trước khi hết hạn", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_NOT_FOUND(1506, "Không tìm thấy yêu cầu gia hạn hợp đồng", HttpStatus.NOT_FOUND),
    CONTRACT_RENEWAL_ALREADY_COMPLETED(1507, "Yêu cầu gia hạn hợp đồng đã được hoàn tất trước đó", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_ALREADY_SIGNED(1508, "Phụ lục gia hạn hợp đồng đã được ký", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_ALREADY_PENDING(1515, "Đang có yêu cầu gia hạn chờ xử lý cho hợp đồng này", HttpStatus.BAD_REQUEST),
    RENEWAL_CONTRACT_NOT_FOUND(1509, "Không tìm thấy hợp đồng thuê kho cần gia hạn", HttpStatus.NOT_FOUND),
    CONTRACT_OTP_NOT_FOUND(1510, "Không tìm thấy yêu cầu mã OTP ký hợp đồng hợp lệ", HttpStatus.BAD_REQUEST),
    CONTRACT_OTP_INVALID(1511, "Mã OTP ký hợp đồng không chính xác hoặc đã hết hạn", HttpStatus.BAD_REQUEST),
    CONTRACT_OTP_RESEND_TOO_SOON(1512, "Vui lòng chờ một lát trước khi yêu cầu gửi lại mã OTP mới", HttpStatus.TOO_MANY_REQUESTS),
    CONTRACT_OTP_ALREADY_VERIFIED(1513, "Mã OTP hợp đồng đã được xác thực trước đó", HttpStatus.BAD_REQUEST),
    CONTRACT_OTP_ATTEMPTS_EXCEEDED(1514, "Bạn đã nhập sai mã OTP quá số lần cho phép", HttpStatus.TOO_MANY_REQUESTS),
    CONTRACT_RENEWAL_CANNOT_BE_REJECTED(1516, "Không thể từ chối yêu cầu gia hạn ở trạng thái hiện tại", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_CANNOT_BE_APPROVED(1517, "Không thể phê duyệt yêu cầu gia hạn ở trạng thái hiện tại", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_REJECTION_REASON_REQUIRED(1518, "Bắt buộc phải nhập lý do từ chối yêu cầu gia hạn", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_CANNOT_BE_CANCELLED(1519, "Không thể hủy yêu cầu gia hạn ở trạng thái hiện tại", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_ALREADY_PAID(1520, "Yêu cầu gia hạn này đã được thanh toán cước phí trước đó", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_NOT_APPROVED(1521, "Yêu cầu gia hạn đang chờ Quản lý cơ sở phê duyệt, chưa thể chọn phương thức ký và thanh toán", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_APPOINTMENT_DATE_REQUIRED(1522, "Bắt buộc phải chọn ngày hẹn đến cơ sở khi gia hạn trực tiếp tại quầy", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_CANNOT_SWITCH_METHOD(1523, "Phụ lục gia hạn đã được ký điện tử trực tuyến, bắt buộc hoàn tất thanh toán trực tuyến và không thể đổi sang hình thức trực tiếp tại quầy", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_INVALID_APPOINTMENT_DATE(1524, "Ngày hẹn đến cơ sở không thể là ngày trong quá khứ", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_REACTIVATE_TOO_EARLY(1525, "Chưa đủ 3 ngày kể từ ngày gửi đơn, chưa thể kích hoạt duyệt lại", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_NOT_REJECTED(1526, "Yêu cầu gia hạn không ở trạng thái bị từ chối", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_CANNOT_UNDO_APPROVAL(1527, "Không thể bỏ duyệt yêu cầu gia hạn khi khách hàng đã tiến hành ký hoặc thanh toán", HttpStatus.BAD_REQUEST),
    STAFF_NOT_CHECKED_IN_SHIFT(1528, "Người tiếp nhận chưa điểm danh vào ca trực hôm nay tại cơ sở này, không thể thực hiện tiếp nhận", HttpStatus.FORBIDDEN),
    CONTRACT_RENEWAL_RECEPTION_CHECKLIST_INCOMPLETE(1529, "Chưa hoàn tất đầy đủ 5 hạng mục kiểm tra tiếp nhận gia hạn bắt buộc", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_STAFF_FACILITY_MISMATCH(1530, "Nhân viên được phân công không thuộc cơ sở của hợp đồng gia hạn", HttpStatus.BAD_REQUEST),

    // ========================= PRICE & PRICE HISTORY (BR-RULE-011) (1600 - 1699) =========================
    PRICE_MUST_BE_GREATER_THAN_ZERO(1600, "Giá thuê phải lớn hơn 0đ", HttpStatus.BAD_REQUEST),
    PRICE_UNCHANGED(1601, "Giá mới phải khác với giá thuê hiện tại", HttpStatus.BAD_REQUEST),
    PRICE_ADJUSTMENT_REASON_REQUIRED(1602, "Bắt buộc phải nhập lý do điều chỉnh giá theo quy định BR-RULE-011", HttpStatus.BAD_REQUEST),
    PRICE_EFFECTIVE_DATE_INVALID(1603, "Ngày hiệu lực giá mới không được quá 1 ngày trong quá khứ", HttpStatus.BAD_REQUEST),
    PRICE_HISTORY_NOT_FOUND(1604, "Không tìm thấy lịch sử thay đổi giá ngăn kho", HttpStatus.NOT_FOUND),

    // ========================= STAFF_ASSIGNMENT (1700 - 1799) =========================
    STAFF_ASSIGNMENT_NOT_FOUND(1700, "Không tìm thấy phân công ca trực", HttpStatus.NOT_FOUND),
    STAFF_USER_NOT_FOUND(1701, "Không tìm thấy thông tin nhân viên", HttpStatus.NOT_FOUND),
    USER_NOT_A_STAFF(1702, "Người dùng được chọn không phải là nhân viên", HttpStatus.BAD_REQUEST),
    STAFF_ALREADY_ASSIGNED_SHIFT(1703, "Nhân viên đã được phân công ca trực vào thời gian này", HttpStatus.CONFLICT),
    STAFF_ASSIGNMENT_FACILITY_MISMATCH(1704, "Nhân viên không thuộc cơ sở đã chọn", HttpStatus.BAD_REQUEST),
    INVALID_ASSIGNMENT_DATE(1705, "Ngày phân công ca trực không thể trong quá khứ", HttpStatus.BAD_REQUEST),
    STAFF_ALREADY_CHECKED_IN(1706, "Nhân viên đã thực hiện điểm danh vào ca trực", HttpStatus.BAD_REQUEST),
    STAFF_NOT_CHECKED_IN(1707, "Nhân viên chưa điểm danh vào ca trực, không thể check-out", HttpStatus.BAD_REQUEST),
    STAFF_ALREADY_CHECKED_OUT(1708, "Ca làm việc này đã hoàn tất check-out", HttpStatus.BAD_REQUEST),
    SHIFT_SWAP_REQUEST_NOT_FOUND(1709, "Yêu cầu đổi ca không tồn tại", HttpStatus.NOT_FOUND),
    SHIFT_SWAP_INVALID_TARGET(1710, "Nhân viên nhận ca không hợp lệ hoặc không cùng cơ sở", HttpStatus.BAD_REQUEST),
    SHIFT_SWAP_ALREADY_PROCESSED(1711, "Yêu cầu đổi ca đã được phê duyệt hoặc bị hủy", HttpStatus.BAD_REQUEST),
    SHIFT_SWAP_TARGET_BUSY(1712, "Nhân viên thay thế đã có ca trực vào khung giờ này", HttpStatus.CONFLICT),
    SHIFT_HANDOVER_NOT_FOUND(1713, "Biên bản bàn giao ca không tồn tại", HttpStatus.NOT_FOUND),
    SHIFT_HANDOVER_ALREADY_ACKNOWLEDGED(1714, "Biên bản bàn giao ca đã được tiếp nhận xác nhận", HttpStatus.BAD_REQUEST),
    SHIFT_HANDOVER_CHECKLIST_INCOMPLETE(1715, "Cần hoàn tất danh mục kiểm tra trước khi bàn giao", HttpStatus.BAD_REQUEST),
    SHIFT_UNAUTHORIZED_ACTION(1716, "Bạn không có quyền thao tác trên ca làm việc này", HttpStatus.FORBIDDEN),
    SHIFT_HANDOVER_EMERGENCY_REASON_REQUIRED(1717, "Bàn giao đột xuất bắt buộc phải nêu rõ lý do", HttpStatus.BAD_REQUEST),
    SHIFT_HANDOVER_SELF_RECEIVE_FORBIDDEN(1718, "Người bàn giao không thể tự tiếp nhận biên bản bàn giao của chính mình", HttpStatus.BAD_REQUEST),
    SHIFT_HANDOVER_INVALID_RECIPIENT(1719, "Nhân sự tiếp nhận phải thuộc cùng cơ sở và có quyền phù hợp", HttpStatus.BAD_REQUEST),
    SHIFT_HANDOVER_DISPATCH_NOT_ALLOWED(1720, "Chỉ Quản lý cơ sở mới có quyền điều phối người nhận bàn giao", HttpStatus.FORBIDDEN),

    // ========================= SEALING & OVERDUE (BR-RULE-012) (1800 - 1899) =========================
    SEALING_RECORD_NOT_FOUND(1800, "Không tìm thấy biên bản niêm phong kho", HttpStatus.NOT_FOUND),
    SEALING_ALREADY_SEALED(1801, "Ngăn kho này hiện đã được niêm phong", HttpStatus.BAD_REQUEST),
    SEALING_ALREADY_UNSEALED(1802, "Ngăn kho này đã được mở niêm phong", HttpStatus.BAD_REQUEST),
    SEALING_WITNESS_REQUIRED(1803, "Bắt buộc phải có người làm chứng khi niêm phong/mở niêm phong theo BR-RULE-012", HttpStatus.BAD_REQUEST),

    // ========================= FEE_TYPE (1900 - 1949) =========================
    FEE_TYPE_NOT_FOUND(1900, "Không tìm thấy loại phí", HttpStatus.NOT_FOUND),
    FEE_TYPE_CODE_EXISTS(1901, "Mã loại phí này đã tồn tại", HttpStatus.CONFLICT),
    FEE_TYPE_AMOUNT_INVALID(1902, "Số tiền phí mặc định không được âm", HttpStatus.BAD_REQUEST),

    // ========================= DISCOUNT (1950 - 1999) =========================
    DISCOUNT_NOT_FOUND(1950, "Không tìm thấy chương trình ưu đãi", HttpStatus.NOT_FOUND),
    DISCOUNT_CODE_EXISTS(1951, "Mã ưu đãi này đã tồn tại", HttpStatus.CONFLICT),
    DISCOUNT_EXPIRED(1952, "Mã ưu đãi đã hết hạn hoặc chưa đến ngày áp dụng", HttpStatus.BAD_REQUEST),
    DISCOUNT_USAGE_LIMIT_EXCEEDED(1953, "Mã ưu đãi đã đạt đến số lượt sử dụng tối đa", HttpStatus.BAD_REQUEST),
    DISCOUNT_MIN_MONTHS_NOT_MET(1954, "Thời gian thuê chưa đạt số tháng tối thiểu để áp dụng mã ưu đãi này", HttpStatus.BAD_REQUEST),
    DISCOUNT_FACILITY_MISMATCH(1955, "Mã ưu đãi không áp dụng cho cơ sở kho này", HttpStatus.BAD_REQUEST),
    DISCOUNT_VALUE_INVALID(1956, "Giá trị ưu đãi không hợp lệ", HttpStatus.BAD_REQUEST),
    DISCOUNT_DATE_INVALID(1957, "Ngày kết thúc không thể trước ngày bắt đầu", HttpStatus.BAD_REQUEST),

    // ========================= RESTORED PAYMENT / SEALING / REFUND / NOTIFICATION =========================
    PAYMENT_TARGET_REQUIRED(757, "Vui lòng cung cấp bookingId hoặc contractId hợp lệ để khởi tạo thanh toán", HttpStatus.BAD_REQUEST),
    UNIT_ALREADY_SEALED(1810, "Kho lưu trữ này hiện đang trong trạng thái niêm phong", HttpStatus.BAD_REQUEST),
    UNIT_NOT_SEALED(1811, "Kho lưu trữ này không ở trạng thái niêm phong", HttpStatus.BAD_REQUEST),
    UNIT_OVERDUE_LOCKED(1812, "Kho đang bị niêm phong khóa cưỡng chế do quá hạn thanh toán. Vui lòng thanh toán công nợ", HttpStatus.FORBIDDEN),
    REFUND_REQUEST_NOT_FOUND(2000, "Yêu cầu hoàn tiền không tồn tại", HttpStatus.NOT_FOUND),
    REFUND_ALREADY_REVIEWED(2001, "Yêu cầu hoàn tiền đã được xem xét/phê duyệt trước đó", HttpStatus.BAD_REQUEST),
    REFUND_ALREADY_PROCESSED(2002, "Yêu cầu hoàn tiền đã được xử lý chi trả hoàn tất", HttpStatus.BAD_REQUEST),
    REFUND_NOT_APPROVED(2003, "Yêu cầu hoàn tiền phải được phê duyệt trước khi xử lý chi trả", HttpStatus.BAD_REQUEST),
    INVALID_REFUND_AMOUNT(2004, "Số tiền hoàn không hợp lệ", HttpStatus.BAD_REQUEST),
    REFUND_TARGET_REQUIRED(2005, "Vui lòng cung cấp bookingId hoặc contractId hợp lệ cho yêu cầu hoàn tiền", HttpStatus.BAD_REQUEST),
    REFUND_INVALID_STATUS_TRANSITION(2006, "Chuyển trạng thái yêu cầu hoàn tiền không hợp lệ", HttpStatus.BAD_REQUEST),
    REFUND_ALREADY_CONFIRMED(2007, "Khách hàng đã xác nhận nhận tiền trước đó", HttpStatus.BAD_REQUEST),
    REFUND_ALREADY_RECONCILED(2008, "Yêu cầu hoàn tiền đã được đối soát hoàn tất", HttpStatus.BAD_REQUEST),
    NOTIFICATION_NOT_FOUND(2100, "Bản ghi thông báo không tồn tại", HttpStatus.NOT_FOUND),
    CONTRACT_NOT_SIGNED(1535, "Hợp đồng chưa được ký hoặc chưa có hồ sơ scan giấy", HttpStatus.BAD_REQUEST),
    INVALID_PAYMENT_METHOD(756, "Phương thức thanh toán không hợp lệ (chỉ chấp nhận CASH hoặc BANK_TRANSFER)", HttpStatus.BAD_REQUEST),
    CHECKIN_STEP_NOT_SATISFIED(729, "Chưa thỏa mãn đầy đủ 4 điều kiện đối soát để chuyển bước", HttpStatus.BAD_REQUEST),
    SMARTLOCK_INTEGRATION_UNAVAILABLE(2200, "Hệ thống khóa thông minh SmartLock tạm thời chưa khả dụng; chưa có lệnh mở khóa nào được gửi đi", HttpStatus.SERVICE_UNAVAILABLE);

    private final int code;
    private final String message;
    private final HttpStatus httpStatus;

    ErrorCode(int code, String message, HttpStatus httpStatus) {
        this.code = code;
        this.message = message;
        this.httpStatus = httpStatus;
    }
}
