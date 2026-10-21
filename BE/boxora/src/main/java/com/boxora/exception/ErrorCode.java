package com.boxora.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {

    // ========================= ROLE (100 - 199) =========================
    ROLE_NOT_FOUND(100, "Không tìm thấy vai trò", HttpStatus.NOT_FOUND),
    ROLE_NAME_EXISTED(101, "Tên vai trò đã tồn tại", HttpStatus.BAD_REQUEST),
    CANNOT_DELETE_SYSTEM_ROLE(102, "Không thể xóa vai trò mặc định của hệ thống", HttpStatus.FORBIDDEN),
    CANNOT_MODIFY_SYSTEM_ROLE(103, "Không thể đổi tên vai trò mặc định của hệ thống", HttpStatus.FORBIDDEN),
    ROLE_IN_USE(104, "Không thể xóa vai trò vì vẫn còn tài khoản đang sử dụng", HttpStatus.CONFLICT),
    ROLE_INACTIVE(105, "Vai trò đang bị vô hiệu hóa", HttpStatus.BAD_REQUEST),

    // ========================= USER (200 - 299) =========================
    USER_NOT_FOUND(200, "Không tìm thấy người dùng", HttpStatus.NOT_FOUND),
    USER_ALREADY_EXISTS(201, "Tên đăng nhập đã tồn tại", HttpStatus.BAD_REQUEST),
    EMAIL_ALREADY_EXISTS(202, "Email này đã được đăng ký", HttpStatus.BAD_REQUEST),
    USER_INACTIVE(203, "Tài khoản đang bị khóa. Vui lòng liên hệ bộ phận hỗ trợ Boxora để được trợ giúp", HttpStatus.FORBIDDEN),

    // ========================= AUTH (300 - 399) =========================
    INVALID_CREDENTIALS(300, "Email hoặc mật khẩu không chính xác", HttpStatus.UNAUTHORIZED),
    UNAUTHORIZED(301, "Vui lòng đăng nhập để tiếp tục", HttpStatus.UNAUTHORIZED),
    FORBIDDEN(302, "Bạn không có quyền thực hiện thao tác này", HttpStatus.FORBIDDEN),
    INVALID_CAPTCHA(303, "Mã xác thực Captcha không chính xác hoặc đã hết hạn", HttpStatus.BAD_REQUEST),
    CAPTCHA_REQUIRED(304, "Vui lòng nhập mã xác thực Captcha để chống bot tự động", HttpStatus.BAD_REQUEST),
    INVALID_GOOGLE_TOKEN(305, "Mã xác thực Google không hợp lệ hoặc đã hết hạn", HttpStatus.UNAUTHORIZED),
    GOOGLE_ACCOUNT_NOT_REGISTERED(306, "Tài khoản Google này chưa được đăng ký trong hệ thống Boxora. Vui lòng đăng ký tài khoản trước.", HttpStatus.NOT_FOUND),
    GOOGLE_LOGIN_NOT_CONFIGURED(307, "Đăng nhập bằng Google chưa được cấu hình trên hệ thống. Vui lòng dùng email và mật khẩu hoặc liên hệ quản trị viên.", HttpStatus.SERVICE_UNAVAILABLE),

    // ========================= TOKEN (400 - 499) =========================
    INVALID_TOKEN(400, "Mã phiên làm việc không hợp lệ", HttpStatus.UNAUTHORIZED),
    TOKEN_EXPIRED(401, "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại", HttpStatus.UNAUTHORIZED),
    TOKEN_REVOKED(402, "Phiên làm việc đã bị thu hồi. Vui lòng đăng nhập lại", HttpStatus.UNAUTHORIZED),
    INVALID_REFRESH_TOKEN(403, "Phiên làm việc không hợp lệ. Vui lòng đăng nhập lại", HttpStatus.UNAUTHORIZED),

    // ========================= PASSWORD (500 - 599) =========================
    PASSWORD_MISMATCH(500, "Mật khẩu nhập lại không khớp", HttpStatus.BAD_REQUEST),
    INVALID_OLD_PASSWORD(501, "Mật khẩu hiện tại không chính xác", HttpStatus.BAD_REQUEST),
    NEW_PASSWORD_SAME_AS_OLD(502, "Mật khẩu mới phải khác mật khẩu hiện tại", HttpStatus.BAD_REQUEST),
    INVALID_RESET_TOKEN(503, "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn", HttpStatus.BAD_REQUEST),

    // ========================= SYSTEM (600 - 699) =========================
    INTERNAL_SERVER_ERROR(600, "Máy chủ đang gặp sự cố. Vui lòng thử lại sau", HttpStatus.INTERNAL_SERVER_ERROR),
    INVALID_REQUEST(601, "Yêu cầu không hợp lệ", HttpStatus.BAD_REQUEST),
    RESOURCE_NOT_FOUND(602, "Không tìm thấy dữ liệu yêu cầu", HttpStatus.NOT_FOUND),
    EMAIL_SEND_FAILED(610, "Không thể gửi email lúc này. Vui lòng thử lại sau hoặc liên hệ quản trị viên.", HttpStatus.SERVICE_UNAVAILABLE),
    RATE_LIMIT_EXCEEDED(612, "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.", HttpStatus.TOO_MANY_REQUESTS),

    // ========================= BOOKING & ACCESS (700 - 799) =================
    BOOKING_NOT_FOUND(700, "Không tìm thấy đơn đặt kho hoặc đơn không thuộc tài khoản của bạn", HttpStatus.NOT_FOUND),
    BOOKING_NOT_CHECKED_IN(701, "Kho chưa được bàn giao nên chưa có mã truy cập", HttpStatus.FORBIDDEN),
    INVALID_PIN_FORMAT(702, "PIN must be exactly 6 digits", HttpStatus.BAD_REQUEST),
    UNIT_TYPE_NOT_FOUND(703, "Không tìm thấy loại kho", HttpStatus.NOT_FOUND),
    STORAGE_UNIT_NOT_FOUND(704, "Không tìm thấy kho", HttpStatus.NOT_FOUND),
    INVALID_PRICING_TARGET(705, "Vui lòng chọn đúng một kho hoặc một loại kho để báo giá", HttpStatus.BAD_REQUEST),
    UNIT_TYPE_PRICE_NOT_CONFIGURED(706, "Kho này chưa được cấu hình đơn giá thuê. Vui lòng liên hệ cơ sở để được hỗ trợ", HttpStatus.CONFLICT),
    NO_AVAILABLE_UNIT(707, "Không còn kho trống phù hợp với loại kho và cơ sở đã chọn", HttpStatus.CONFLICT),
    STORAGE_UNIT_CODE_EXISTED(708, "Mã kho đã tồn tại trong cơ sở này", HttpStatus.BAD_REQUEST),
    STORAGE_UNIT_IN_USE(709, "Không thể xóa kho vì đã có đặt kho hoặc hợp đồng liên quan", HttpStatus.CONFLICT),
    STORAGE_UNIT_CANNOT_MAINTAIN(710, "Không thể chuyển kho sang bảo trì khi kho đang được thuê hoặc giữ chỗ", HttpStatus.BAD_REQUEST),
    STORAGE_UNIT_NOT_AVAILABLE(711, "Kho này hiện không còn trống để đặt. Vui lòng chọn kho khác", HttpStatus.CONFLICT),
    UNIT_TYPE_NAME_EXISTED(712, "Tên loại kho đã tồn tại", HttpStatus.BAD_REQUEST),
    UNIT_TYPE_IN_USE(713, "Không thể xóa loại kho vì vẫn còn kho thuộc loại này", HttpStatus.CONFLICT),
    BOOKING_ALREADY_CANCELLED(714, "Đơn đặt kho đã được hủy trước đó", HttpStatus.BAD_REQUEST),
    BOOKING_ALREADY_COMPLETED(715, "Đơn đặt kho đã kết thúc nên không thể hủy", HttpStatus.BAD_REQUEST),
    BOOKING_CANNOT_BE_CANCELLED(716, "Không thể hủy đơn đặt kho ở trạng thái hiện tại", HttpStatus.BAD_REQUEST),
    BOOKING_START_DATE_PAST(717, "Ngày bắt đầu thuê không được ở trong quá khứ", HttpStatus.BAD_REQUEST),
    BOOKING_ADVANCE_NOTICE_EXCEEDED(718, "Chỉ được đặt kho trước tối đa 30 ngày", HttpStatus.BAD_REQUEST),
    STORAGE_UNIT_SOFT_LOCKED(719, "Kho đang được một khách hàng khác giữ chỗ. Vui lòng chọn kho khác", HttpStatus.CONFLICT),
    BOOKING_MINIMUM_DURATION_INVALID(720, "Thời hạn thuê chưa đạt số tháng tối thiểu theo chính sách của cơ sở", HttpStatus.BAD_REQUEST),
    HANDOVER_PREREQUISITES_NOT_MET(721, "Không đủ 4 điều kiện bàn giao kho vật lý theo BR-RULE-005 (Cọc + Tiền thuê tháng đầu + Hợp đồng ký + Đối soát CCCD)", HttpStatus.BAD_REQUEST),
    HANDOVER_UNIT_NOT_READY(722, "Ngăn kho không ở trạng thái sẵn sàng để bàn giao theo BR-RULE-006", HttpStatus.CONFLICT),
    HANDOVER_ALREADY_ACTIVE(723, "Đơn đặt kho đã được check-in bàn giao trước đó", HttpStatus.BAD_REQUEST),
    RETURN_INSPECTION_CHECKLIST_INCOMPLETE(724, "Chưa hoàn tất đầy đủ 5 tiêu chuẩn kiểm tra hiện trạng trả kho theo BR-RULE-013", HttpStatus.BAD_REQUEST),
    BOOKING_NOT_ACTIVE_FOR_RETURN(725, "Đơn đặt kho phải đang thuê mới được thực hiện trả kho", HttpStatus.BAD_REQUEST),
    RETURN_PHOTO_EVIDENCE_REQUIRED(726, "Cần tối thiểu 2 ảnh chụp hiện trường để xác nhận nghiệm thu trả kho theo BR-RULE-013", HttpStatus.BAD_REQUEST),
    // --- Handover, evidence upload and counter payments (2200 - 2249) ---
    FILE_UPLOAD_EMPTY(2200, "Chưa chọn tệp để tải lên", HttpStatus.BAD_REQUEST),
    FILE_FORMAT_NOT_ALLOWED(2201, "Định dạng tệp không hợp lệ. Chỉ chấp nhận ảnh JPG, PNG, WEBP hoặc tệp PDF", HttpStatus.BAD_REQUEST),
    FILE_TOO_LARGE(2202, "Tệp vượt quá giới hạn 10 MB. Vui lòng chọn tệp nhỏ hơn", HttpStatus.BAD_REQUEST),
    FILE_UPLOAD_FAILED(2203, "Không lưu được tệp tải lên. Vui lòng thử lại", HttpStatus.INTERNAL_SERVER_ERROR),
    HANDOVER_EVIDENCE_URL_INVALID(2204, "Tệp minh chứng chưa được tải lên hệ thống. Hãy tải tệp lên rồi gửi lại đường dẫn nhận được", HttpStatus.BAD_REQUEST),
    HANDOVER_INSPECTION_REQUIRED(2205, "Chưa có biên bản nghiệm thu kho đạt đủ 5/5 tiêu chí kèm tối thiểu 2 ảnh hiện trạng", HttpStatus.BAD_REQUEST),
    HANDOVER_BOOKING_NOT_READY(2206, "Đơn đặt kho không ở trạng thái có thể thực hiện thao tác này", HttpStatus.BAD_REQUEST),
    HANDOVER_NOT_CHECKED_IN(2207, "Kho chưa được bàn giao nên chưa có mã PIN để gửi cho khách", HttpStatus.BAD_REQUEST),
    HANDOVER_PAYMENT_NOT_PENDING_TRANSFER(2208, "Chỉ xác nhận được khoản chuyển khoản đang chờ đối soát", HttpStatus.BAD_REQUEST),
    HANDOVER_PAYMENT_PROOF_REQUIRED(2209, "Khoản chuyển khoản cần có mã tham chiếu ngân hàng và ảnh biên lai trước khi xác nhận", HttpStatus.BAD_REQUEST),
    HANDOVER_PAYMENT_OVER_REMAINING(2210, "Số tiền ghi nhận vượt quá số tiền còn phải thu của đơn", HttpStatus.BAD_REQUEST),
    HANDOVER_LOOKUP_NOT_FOUND(2211, "Không tìm thấy lượt đặt kho khớp với mã này", HttpStatus.NOT_FOUND),
    HANDOVER_IDENTITY_FORMAT_INVALID(2212, "Số giấy tờ không đúng định dạng: CCCD gồm 9 hoặc 12 chữ số, hộ chiếu gồm 6-12 ký tự chữ và số", HttpStatus.BAD_REQUEST),
    HANDOVER_REFUND_BANK_REQUIRED(2213, "Hoàn cọc bằng chuyển khoản cần đủ tên ngân hàng, số tài khoản và tên chủ tài khoản của khách", HttpStatus.BAD_REQUEST),
    HANDOVER_CUSTOMER_EMAIL_MISSING(2214, "Khách hàng chưa có email trong hồ sơ nên không thể gửi mã PIN qua email", HttpStatus.BAD_REQUEST),
    FILE_LINK_INVALID(2215, "Liên kết tệp không hợp lệ hoặc đã hết hạn. Hãy mở lại tệp từ hệ thống", HttpStatus.FORBIDDEN),
    FILE_NOT_FOUND(2216, "Không tìm thấy tệp", HttpStatus.NOT_FOUND),
    FILE_ACCESS_DENIED(2217, "Bạn không có quyền xem tệp này", HttpStatus.FORBIDDEN),
    BOOKING_PAYMENT_EXPIRED(727, "Đã hết thời hạn thanh toán giữ chỗ của đơn này", HttpStatus.CONFLICT),
    BOOKING_REQUEST_NOT_PENDING_APPROVAL(728, "Yêu cầu thuê kho không còn ở trạng thái chờ duyệt", HttpStatus.CONFLICT),
    BOOKING_ALREADY_ACTIVE(729, "Đơn đặt kho đã kích hoạt và đang sử dụng, không thể đổi lịch", HttpStatus.BAD_REQUEST),
    BOOKING_ALREADY_HANDED_OVER(730, "Kho đã được bàn giao thực tế, không thể đổi lịch nhận kho", HttpStatus.BAD_REQUEST),

    // ========================= PAYMENT (750 - 799) =========================
    PAYMENT_NOT_FOUND(750, "Không tìm thấy giao dịch thanh toán", HttpStatus.NOT_FOUND),
    PAYMENT_ALREADY_PROCESSED(751, "Khoản thanh toán này đã được xử lý trước đó", HttpStatus.CONFLICT),
    INVALID_PAYMENT_SIGNATURE(752, "Chữ ký xác thực giao dịch VNPay không hợp lệ", HttpStatus.BAD_REQUEST),
    PAYMENT_AMOUNT_MISMATCH(753, "Số tiền thanh toán không khớp với số tiền hệ thống tính. Vui lòng tải lại và thử lại", HttpStatus.BAD_REQUEST),
    PAYMENT_FAILED(754, "Giao dịch thanh toán không thành công hoặc đã bị hủy", HttpStatus.BAD_REQUEST),
    PAYMENT_AMOUNT_INVALID(755, "Số tiền thanh toán không hợp lệ (phải lớn hơn 0đ)", HttpStatus.BAD_REQUEST),

    // ========================= ROLE_PERMISSION (800 - 899) =========================
    ROLE_PERMISSION_NOT_FOUND(800, "Không tìm thấy phân quyền của vai trò", HttpStatus.NOT_FOUND),
    ROLE_PERMISSION_ALREADY_EXISTS(801, "Quyền này đã được gán cho vai trò", HttpStatus.BAD_REQUEST),

    // ========================= PERMISSION (900 - 999) =========================
    PERMISSION_NOT_FOUND(900, "Không tìm thấy quyền", HttpStatus.NOT_FOUND),
    PERMISSION_NAME_EXISTED(901, "Tên quyền đã tồn tại", HttpStatus.BAD_REQUEST),
    PERMISSION_GROUP_EXISTED(902, "Nhóm quyền đã tồn tại", HttpStatus.BAD_REQUEST),
    PERMISSION_IN_USE(903, "Không thể xóa quyền vì đang được gán cho vai trò", HttpStatus.CONFLICT),
    PERMISSION_INACTIVE(904, "Quyền đang bị vô hiệu hóa", HttpStatus.BAD_REQUEST),

    // ========================= FACILITY (1000 - 1099) =========================
    FACILITY_NOT_FOUND(1000, "Không tìm thấy cơ sở", HttpStatus.NOT_FOUND),
    FACILITY_CODE_EXISTED(1001, "Mã cơ sở đã tồn tại", HttpStatus.BAD_REQUEST),
    INVALID_MANAGER_TO_ASSIGN(1002, "Chỉ có thể gán tài khoản Quản lý cơ sở làm người phụ trách cơ sở", HttpStatus.BAD_REQUEST),
    FACILITY_ACCESS_DENIED(1003, "Bạn không có quyền truy cập dữ liệu của cơ sở này", HttpStatus.FORBIDDEN),
    FACILITY_NAME_EXISTED(1004, "Tên cơ sở đã tồn tại", HttpStatus.BAD_REQUEST),
    FACILITY_UNSAFE_DEACTIVATION(1006, "Cơ sở còn kho đang được thuê hoặc giữ chỗ nên chưa thể ngừng hoạt động. Hãy hoàn tất hoặc chuyển các hợp đồng trước", HttpStatus.CONFLICT),
    FACILITY_STATUS_INVALID(1007, "Trạng thái cơ sở không hợp lệ", HttpStatus.BAD_REQUEST),
    FACILITY_COORDINATES_INVALID(1008, "Vui lòng nhập cả vĩ độ và kinh độ, hoặc để trống cả hai", HttpStatus.BAD_REQUEST),
    FACILITY_NOT_ACCEPTING_BOOKINGS(1009, "Cơ sở này hiện không nhận đặt kho", HttpStatus.CONFLICT),

    // ========================= FACILITY_POLICY (1100 - 1199) =========================
    FACILITY_POLICY_NOT_FOUND(1100, "Cơ sở này chưa có chính sách riêng", HttpStatus.NOT_FOUND),
    FACILITY_POLICY_ALREADY_EXISTS(1101, "Cơ sở này đã có chính sách. Hãy chỉnh sửa chính sách hiện có", HttpStatus.BAD_REQUEST),
    FACILITY_POLICY_INVALID_CANCELLATION(1102, "Mốc hoàn 100% phải lớn hơn hoặc bằng mốc hoàn một phần", HttpStatus.BAD_REQUEST),
    FACILITY_POLICY_INVALID_PRICES(1103, "Mỗi loại kho chỉ được có một dòng giá trong chính sách cơ sở", HttpStatus.BAD_REQUEST),
    FACILITY_POLICY_INVALID_HOLD(1104, "Thời gian giữ chỗ không hợp lệ: gia hạn tối đa 168 giờ, giữ chỗ trước tối đa 90 ngày", HttpStatus.BAD_REQUEST),
    FACILITY_POLICY_INVALID_OVERDUE_STAGES(1105, "Các mốc quá hạn phải tăng dần: ân hạn, khóa PIN, niêm phong", HttpStatus.BAD_REQUEST),

    // ========================= SUPPORT_TICKET (1200 - 1299) =========================
    TICKET_NOT_FOUND(1200, "Không tìm thấy phiếu sự cố hoặc phiếu không thuộc quyền xem của bạn", HttpStatus.NOT_FOUND),
    TICKET_IMAGE_UPLOAD_FAILED(1201, "Tải tệp tin ảnh bằng chứng thất bại", HttpStatus.INTERNAL_SERVER_ERROR),
    TICKET_INVALID_IMAGE_FORMAT(1202, "Định dạng tệp không hợp lệ. Chỉ chấp nhận ảnh JPG, PNG, WEBP, GIF", HttpStatus.BAD_REQUEST),
    TICKET_IMAGE_SIZE_EXCEEDED(1203, "Kích thước tệp ảnh vượt quá giới hạn cho phép (10MB)", HttpStatus.BAD_REQUEST),
    TICKET_INVALID_STATUS_TRANSITION(1204, "Chuyển trạng thái sự cố không hợp lệ theo quy trình", HttpStatus.BAD_REQUEST),
    TICKET_FACILITY_MISMATCH(1205, "Không có quyền thao tác trên sự cố ngoài phạm vi cơ sở được phân công", HttpStatus.FORBIDDEN),
    TICKET_STAFF_NOT_IN_FACILITY(1206, "Nhân viên được phân công không thuộc cơ sở này", HttpStatus.BAD_REQUEST),
    TICKET_ALREADY_CLOSED(1207, "Phiếu sự cố đã được đóng hoàn tất", HttpStatus.BAD_REQUEST),
    TICKET_FACILITY_REQUIRED(1208, "Chưa xác định được cơ sở xử lý. Vui lòng chọn kho hoặc cơ sở liên quan khi gửi yêu cầu hỗ trợ", HttpStatus.BAD_REQUEST),
    TICKET_INVALID_PRIORITY(1209, "Mức ưu tiên không hợp lệ. Chọn một trong: Thấp, Trung bình, Cao, Khẩn cấp", HttpStatus.BAD_REQUEST),
    TICKET_INVALID_CATEGORY(1210, "Danh mục sự cố không hợp lệ. Hãy chọn một danh mục có trong danh sách", HttpStatus.BAD_REQUEST),
    TICKET_EVIDENCE_INVALID(1211, "Ảnh minh chứng chưa được tải lên hệ thống hoặc không phải của bạn. Hãy tải ảnh lên rồi gửi lại", HttpStatus.BAD_REQUEST),
    TICKET_NOT_ASSIGNED_TO_YOU(1212, "Phiếu sự cố này đang do nhân viên khác phụ trách. Chỉ người được phân công hoặc quản lý cơ sở mới xử lý được", HttpStatus.FORBIDDEN),
    TICKET_RESOLUTION_NOTE_REQUIRED(1213, "Vui lòng ghi rõ cách đã xử lý sự cố trước khi xác nhận hoàn tất", HttpStatus.BAD_REQUEST),
    TICKET_NOT_IN_PROGRESS(1214, "Chỉ xác nhận hoàn tất được phiếu đang xử lý. Hãy nhận xử lý phiếu trước", HttpStatus.BAD_REQUEST),
    TICKET_ALREADY_TAKEN(1215, "Phiếu sự cố đã có người nhận xử lý", HttpStatus.CONFLICT),

    // ========================= ACTIVITY_LOG (1300 - 1399) =========================
    ACTIVITY_LOG_NOT_FOUND(1300, "Không tìm thấy bản ghi nhật ký", HttpStatus.NOT_FOUND),

    // ========================= MASTER_KEY (1400 - 1499) =========================
    MASTER_KEY_OVERRIDE_NOT_FOUND(1400, "Master key override record not found", HttpStatus.NOT_FOUND),
    MASTER_KEY_WITNESS_REQUIRED(1401, "Witness must be a different user from the person performing the override", HttpStatus.BAD_REQUEST),
    MASTER_KEY_WITNESS_NOT_FOUND(1402, "Witness user not found", HttpStatus.NOT_FOUND),
    MASTER_KEY_WITNESS_WRONG_FACILITY(1403, "Witness must belong to the same facility", HttpStatus.BAD_REQUEST),
    // A wrong witness password is a business validation failure, not an expired session: it must NOT be 401
    // (clients treat 401 as "refresh the token and replay", which double-counted attempts toward the lockout).
    MASTER_KEY_WITNESS_INVALID_CREDENTIALS(1404, "Mật khẩu người chứng kiến không đúng", HttpStatus.BAD_REQUEST),
    MASTER_KEY_WITNESS_INACTIVE(1405, "Witness user account is inactive or disabled", HttpStatus.BAD_REQUEST),
    MASTER_KEY_WITNESS_UNAUTHORIZED_ROLE(1406, "Witness must be a staff member or manager", HttpStatus.FORBIDDEN),
    MASTER_KEY_RESOURCE_WRONG_FACILITY(1407, "Target storage unit does not belong to the specified facility", HttpStatus.BAD_REQUEST),

    // ========================= CONTRACT & RENEWAL (1500 - 1599) =========================
    CONTRACT_NOT_FOUND(1500, "Không tìm thấy hợp đồng thuê", HttpStatus.NOT_FOUND),
    CONTRACT_SIGNING_FAILED(1501, "Không tạo được yêu cầu ký hợp đồng điện tử. Vui lòng thử lại sau", HttpStatus.INTERNAL_SERVER_ERROR),
    CONTRACT_SIGNING_INVALID_WEBHOOK_TOKEN(1502, "Mã xác thực webhook không hợp lệ", HttpStatus.UNAUTHORIZED),
    CONTRACT_ALREADY_SIGNED(1503, "Hợp đồng đã được ký", HttpStatus.BAD_REQUEST),
    CONTRACT_NOT_ACTIVE(1504, "Hợp đồng không còn hiệu lực", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_WINDOW_CLOSED(1505, "Hợp đồng chưa đến thời gian được gia hạn theo chính sách của cơ sở", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_NOT_FOUND(1506, "Không tìm thấy yêu cầu gia hạn", HttpStatus.NOT_FOUND),
    CONTRACT_RENEWAL_ALREADY_COMPLETED(1507, "Yêu cầu gia hạn đã hoàn tất", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_ALREADY_SIGNED(1508, "Phụ lục gia hạn đã được ký", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_ALREADY_PENDING(1515, "Hợp đồng đang có một yêu cầu gia hạn chưa hoàn tất. Hãy hoàn tất hoặc hủy yêu cầu đó trước", HttpStatus.BAD_REQUEST),
    RENEWAL_CONTRACT_NOT_FOUND(1509, "Không tìm thấy hợp đồng thuê", HttpStatus.NOT_FOUND),
    CONTRACT_OTP_NOT_FOUND(1510, "Chưa có mã OTP ký hợp đồng. Vui lòng gửi mã OTP trước", HttpStatus.BAD_REQUEST),
    CONTRACT_OTP_INVALID(1511, "Mã OTP không đúng hoặc đã hết hạn", HttpStatus.BAD_REQUEST),
    CONTRACT_OTP_RESEND_TOO_SOON(1512, "Vui lòng đợi trước khi yêu cầu gửi lại mã OTP", HttpStatus.TOO_MANY_REQUESTS),
    CONTRACT_OTP_ALREADY_VERIFIED(1513, "Mã OTP đã được xác thực", HttpStatus.BAD_REQUEST),
    CONTRACT_OTP_ATTEMPTS_EXCEEDED(1514, "Bạn đã nhập sai mã OTP quá nhiều lần. Vui lòng yêu cầu mã mới", HttpStatus.TOO_MANY_REQUESTS),

    // ========================= PRICE & PRICE HISTORY (BR-RULE-011) (1600 - 1699) =========================
    PRICE_MUST_BE_GREATER_THAN_ZERO(1600, "Đơn giá phải lớn hơn 0", HttpStatus.BAD_REQUEST),
    PRICE_UNCHANGED(1601, "Đơn giá mới phải khác đơn giá hiện tại", HttpStatus.BAD_REQUEST),
    PRICE_ADJUSTMENT_REASON_REQUIRED(1602, "Vui lòng nhập lý do điều chỉnh giá (BR-RULE-011)", HttpStatus.BAD_REQUEST),
    PRICE_EFFECTIVE_DATE_INVALID(1603, "Ngày hiệu lực không được lùi quá 1 ngày so với hiện tại", HttpStatus.BAD_REQUEST),
    PRICE_HISTORY_NOT_FOUND(1604, "Không tìm thấy lịch sử giá của kho", HttpStatus.NOT_FOUND),

    // ========================= STAFF_ASSIGNMENT (1700 - 1799) =========================
    STAFF_ASSIGNMENT_NOT_FOUND(1700, "Staff assignment not found", HttpStatus.NOT_FOUND),
    STAFF_USER_NOT_FOUND(1701, "Staff user not found", HttpStatus.NOT_FOUND),
    USER_NOT_A_STAFF(1702, "The selected user is not a staff member", HttpStatus.BAD_REQUEST),
    STAFF_ALREADY_ASSIGNED_SHIFT(1703, "Staff member is already assigned to this shift on the specified date", HttpStatus.CONFLICT),
    STAFF_ASSIGNMENT_FACILITY_MISMATCH(1704, "Staff member does not belong to the selected facility", HttpStatus.BAD_REQUEST),
    INVALID_ASSIGNMENT_DATE(1705, "Assignment date cannot be in the past", HttpStatus.BAD_REQUEST),
    STAFF_SHIFT_OVERLAP(1706, "Nhân viên đã có ca trực trùng hoặc chồng giờ trong ngày này", HttpStatus.CONFLICT),
    STAFF_ASSIGNMENT_STATUS_INVALID(1707, "Không thể chuyển trạng thái ca trực này", HttpStatus.BAD_REQUEST),
    STAFF_ASSIGNMENT_LOCKED(1708, "Ca trực đã diễn ra hoặc đã vào ca nên không thể đổi ca, khu vực hay vai trò", HttpStatus.CONFLICT),

    // ========================= SEALING & OVERDUE (BR-RULE-012) (1800 - 1899) =========================
    SEALING_RECORD_NOT_FOUND(1800, "Sealing record not found", HttpStatus.NOT_FOUND),
    SEALING_ALREADY_SEALED(1801, "Storage unit is already sealed", HttpStatus.BAD_REQUEST),
    SEALING_ALREADY_UNSEALED(1802, "Storage unit is already unsealed", HttpStatus.BAD_REQUEST),
    SEALING_WITNESS_REQUIRED(1803, "Witness is mandatory for sealing/unsealing under BR-RULE-012", HttpStatus.BAD_REQUEST),
    // --- Agent E: overdue lifecycle, sealing eligibility, access restoration (1820 - 1839) ---
    OVERDUE_ACTION_NOT_ELIGIBLE(1820, "Hợp đồng chưa đến mốc xử lý này theo chính sách quá hạn của cơ sở", HttpStatus.CONFLICT),
    OVERDUE_CONTRACT_NOT_OVERDUE(1821, "Hợp đồng không ở tình trạng quá hạn", HttpStatus.CONFLICT),
    SEALING_CONTRACT_REQUIRED(1822, "Kho không có hợp đồng quá hạn nên không thể lập biên bản niêm phong", HttpStatus.CONFLICT),
    SEALING_WITNESS_INVALID(1823, "Người chứng kiến phải là nhân viên hoặc quản lý đang hoạt động của cùng cơ sở và khác người lập biên bản", HttpStatus.BAD_REQUEST),
    SEAL_TAG_ALREADY_USED(1824, "Số tem niêm phong này đã được sử dụng cho một biên bản khác", HttpStatus.CONFLICT),
    OVERDUE_ACCESS_NOT_LOCKED(1825, "Quyền truy cập kho của hợp đồng này đang không bị khóa", HttpStatus.CONFLICT),
    OVERDUE_UNIT_SEALED(1826, "Kho đang được niêm phong. Hãy gỡ niêm phong trước khi mở khóa truy cập", HttpStatus.CONFLICT),
    OVERDUE_HOLD_DATE_INVALID(1827, "Ngày giữ quyền truy cập phải từ hôm nay đến tối đa 30 ngày tới", HttpStatus.BAD_REQUEST),
    OVERDUE_PROCESS_FORBIDDEN(1828, "Chỉ quản trị viên hoặc quản lý kinh doanh được chạy xử lý quá hạn cho toàn hệ thống hoặc theo ngày giả lập", HttpStatus.FORBIDDEN),
    MASTER_KEY_TOO_MANY_ATTEMPTS(1829, "Xác thực người chứng kiến sai quá nhiều lần. Vui lòng thử lại sau 15 phút", HttpStatus.TOO_MANY_REQUESTS),

    // ========================= FEE_TYPE (1900 - 1949) =========================
    FEE_TYPE_NOT_FOUND(1900, "Không tìm thấy loại phí", HttpStatus.NOT_FOUND),
    FEE_TYPE_CODE_EXISTS(1901, "Mã loại phí đã tồn tại", HttpStatus.CONFLICT),
    FEE_TYPE_AMOUNT_INVALID(1902, "Đơn giá mặc định của loại phí không được âm", HttpStatus.BAD_REQUEST),

    // ========================= DISCOUNT (1950 - 1999) =========================
    DISCOUNT_NOT_FOUND(1950, "Không tìm thấy chương trình ưu đãi", HttpStatus.NOT_FOUND),
    DISCOUNT_CODE_EXISTS(1951, "Mã ưu đãi đã tồn tại", HttpStatus.CONFLICT),
    DISCOUNT_EXPIRED(1952, "Mã ưu đãi đã hết hạn hoặc chưa đến thời gian áp dụng", HttpStatus.BAD_REQUEST),
    DISCOUNT_USAGE_LIMIT_EXCEEDED(1953, "Mã ưu đãi đã hết lượt sử dụng", HttpStatus.BAD_REQUEST),
    DISCOUNT_MIN_MONTHS_NOT_MET(1954, "Thời hạn thuê chưa đạt mức tối thiểu để dùng mã ưu đãi này", HttpStatus.BAD_REQUEST),
    DISCOUNT_FACILITY_MISMATCH(1955, "Mã ưu đãi không áp dụng cho cơ sở này", HttpStatus.BAD_REQUEST),
    DISCOUNT_VALUE_INVALID(1956, "Giá trị ưu đãi không hợp lệ", HttpStatus.BAD_REQUEST),
    DISCOUNT_DATE_INVALID(1957, "Ngày kết thúc không được sớm hơn ngày bắt đầu", HttpStatus.BAD_REQUEST),
    DISCOUNT_CODE_INVALID(1958, "Mã ưu đãi không hợp lệ", HttpStatus.BAD_REQUEST),

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
    REFUND_INVALID_STATUS_TRANSITION(2006, "Chuyển trạng thái yêu cầu hoàn tiền không hợp lệ", HttpStatus.BAD_REQUEST),
    REFUND_ALREADY_CONFIRMED(2007, "Khách hàng đã xác nhận nhận tiền trước đó", HttpStatus.BAD_REQUEST),
    REFUND_ALREADY_RECONCILED(2008, "Yêu cầu hoàn tiền đã được đối soát hoàn tất", HttpStatus.BAD_REQUEST),
    // --- Agent C: booking, payment, contract signing, renewal, refund (2300 - 2349) ---
    BOOKING_CODE_GENERATION_FAILED(2300, "Không tạo được mã đặt kho. Vui lòng thử lại", HttpStatus.SERVICE_UNAVAILABLE),
    BOOKING_STATUS_FILTER_INVALID(2301, "Trạng thái lọc đơn đặt kho không hợp lệ", HttpStatus.BAD_REQUEST),
    BOOKING_FEATURE_REMOVED(2302, "Chức năng này không còn được hỗ trợ. Vui lòng gia hạn qua mục Hợp đồng", HttpStatus.GONE),
    REMOTE_UNLOCK_NOT_AVAILABLE(2303, "Kho chưa được bàn giao hoặc đang bị khóa nên không thể mở khóa từ xa", HttpStatus.BAD_REQUEST),
    PAYMENT_TYPE_NOT_ALLOWED(2310, "Loại thanh toán này không được tạo trực tuyến. Vui lòng dùng đúng mục thanh toán trong cổng khách hàng", HttpStatus.BAD_REQUEST),
    PAYMENT_NOT_DUE(2311, "Hiện không có khoản nào cần thanh toán", HttpStatus.BAD_REQUEST),
    PAYMENT_BOOKING_NOT_PAYABLE(2312, "Đơn đặt kho không ở trạng thái có thể thanh toán trực tuyến", HttpStatus.CONFLICT),
    PAYMENT_GATEWAY_UNAVAILABLE(2313, "Không kết nối được cổng thanh toán VNPay. Vui lòng thử lại sau", HttpStatus.SERVICE_UNAVAILABLE),
    CONTRACT_OTP_SEND_FAILED(2320, "Không gửi được mã OTP qua email. Vui lòng thử lại sau hoặc ký hợp đồng tại quầy", HttpStatus.SERVICE_UNAVAILABLE),
    CONTRACT_MOCK_SIGN_DISABLED(2321, "Hệ thống đã kết nối DocuSeal. Vui lòng ký hợp đồng qua liên kết DocuSeal", HttpStatus.CONFLICT),
    CONTRACT_SIGNING_PROVIDER_UNAVAILABLE(2322, "Dịch vụ ký điện tử DocuSeal đang không phản hồi. Vui lòng thử lại sau", HttpStatus.SERVICE_UNAVAILABLE),
    CONTRACT_RENEWAL_NOT_ALLOWED(2323, "Hợp đồng ở trạng thái hiện tại không thể gia hạn", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_TERM_TOO_SHORT(2324, "Thời hạn gia hạn phải kéo dài qua ngày hôm nay. Vui lòng chọn số tháng dài hơn", HttpStatus.BAD_REQUEST),
    CONTRACT_RENEWAL_NOT_PAYABLE(2325, "Yêu cầu gia hạn không còn ở trạng thái chờ thanh toán", HttpStatus.CONFLICT),
    CONTRACT_RENEWAL_CANNOT_CANCEL(2326, "Không thể hủy yêu cầu gia hạn đã thanh toán hoặc đã hoàn tất", HttpStatus.CONFLICT),
    REFUND_BANK_INFO_REQUIRED(2330, "Khách hàng chưa cung cấp tài khoản nhận hoàn tiền", HttpStatus.BAD_REQUEST),
    REFUND_BANK_INFO_INVALID(2331, "Thông tin tài khoản nhận hoàn tiền không hợp lệ", HttpStatus.BAD_REQUEST),
    REFUND_BANK_INFO_LOCKED(2332, "Yêu cầu hoàn tiền đã chuyển khoản nên không thể đổi tài khoản nhận", HttpStatus.CONFLICT),
    REFUND_STATUS_FILTER_INVALID(2333, "Trạng thái lọc yêu cầu hoàn tiền không hợp lệ", HttpStatus.BAD_REQUEST),
    // Agent C (booking / payment / contract / refund) 2340 - 2349
    BOOKING_REQUEST_EXPIRED(2340, "Yêu cầu thuê kho đã hết hạn và đã được hủy tự động, kho đã được mở lại cho khách khác", HttpStatus.CONFLICT),
    BOOKING_ASSIGNED_STAFF_INVALID(2341, "Nhân viên tiếp nhận phải là nhân viên đang làm việc tại cơ sở của đơn này", HttpStatus.BAD_REQUEST),
    BOOKING_FACILITY_NOT_OPERATING(2342, "Cơ sở đang bảo trì hoặc tạm ngưng hoạt động nên chưa nhận đặt kho mới", HttpStatus.CONFLICT),
    BOOKING_CUSTOMER_REQUIRED(2343, "Vui lòng chọn tài khoản khách hàng đứng tên đơn đặt kho", HttpStatus.BAD_REQUEST),
    BOOKING_ACCESS_ENDED(2344, "Kho đã được trả nên mã truy cập không còn hiệu lực", HttpStatus.FORBIDDEN),
    CONTRACT_SIGNER_NOT_CUSTOMER(2345, "Chỉ khách hàng đứng tên hợp đồng mới được ký điện tử, sau khi xác thực mã OTP gửi tới email của mình", HttpStatus.FORBIDDEN),
    NOTIFICATION_NOT_FOUND(2100, "Bản ghi thông báo không tồn tại", HttpStatus.NOT_FOUND),

    // ========================= REPORTS & CHATBOT (2700 - 2799) =========================
    REPORT_INVALID_PERIOD(2700, "Khoảng thời gian báo cáo không hợp lệ: ngày bắt đầu phải trước hoặc bằng ngày kết thúc", HttpStatus.BAD_REQUEST),
    OVERDUE_REMINDER_NOT_OVERDUE(2701, "Hợp đồng này chưa quá hạn nên không cần gửi nhắc nợ", HttpStatus.BAD_REQUEST),
    OVERDUE_REMINDER_NO_EMAIL(2702, "Khách hàng chưa có địa chỉ email nên không thể gửi nhắc nợ. Hãy liên hệ khách qua số điện thoại.", HttpStatus.BAD_REQUEST),
    OVERDUE_REMINDER_EMAIL_UNAVAILABLE(2703, "Máy chủ chưa cấu hình dịch vụ gửi email nên chưa thể gửi nhắc nợ. Vui lòng liên hệ quản trị viên.", HttpStatus.SERVICE_UNAVAILABLE),
    OVERDUE_REMINDER_TOO_SOON(2704, "Vừa gửi email nhắc nợ cho khách này. Vui lòng đợi ít phút trước khi gửi lại", HttpStatus.TOO_MANY_REQUESTS),
    OVERDUE_LOCKOUT_HOLD_ACTIVE(2705, "Quản lý đang giữ quyền truy cập của khách này. Hãy nhập lý do khóa sớm để ghi đè", HttpStatus.CONFLICT),
    CHATBOT_UNAVAILABLE(2710, "Trợ lý Boxora AI tạm thời chưa sẵn sàng. Vui lòng thử lại sau hoặc xem thông tin tại trang Khám phá kho.", HttpStatus.SERVICE_UNAVAILABLE),
    CHATBOT_RATE_LIMITED(2711, "Bạn gửi câu hỏi quá nhanh. Vui lòng đợi ít phút rồi thử lại.", HttpStatus.TOO_MANY_REQUESTS),
    CHATBOT_MESSAGE_INVALID(2712, "Nội dung câu hỏi không hợp lệ", HttpStatus.BAD_REQUEST),
    POLICY_EXCEPTION_NOT_FACILITY_MANAGER(2720, "Tài khoản này không có vai trò Quản lý cơ sở nên không thể được cấp quyền sửa ngoại lệ chính sách", HttpStatus.BAD_REQUEST),
    POLICY_EXCEPTION_MANAGER_INACTIVE(2721, "Tài khoản quản lý cơ sở này đang bị khóa. Hãy kích hoạt lại tài khoản trước khi cấp quyền sửa ngoại lệ", HttpStatus.BAD_REQUEST),
    POLICY_EXCEPTION_WRONG_FACILITY(2722, "Quản lý này không được phân công vào cơ sở của chính sách nên không thể cấp quyền sửa ngoại lệ", HttpStatus.BAD_REQUEST),
    CONTRACT_NOT_SIGNED(1516, "Hợp đồng chưa được ký hoặc chưa có hồ sơ scan giấy", HttpStatus.BAD_REQUEST),
    INVALID_PAYMENT_METHOD(756, "Phương thức thanh toán không hợp lệ (chỉ chấp nhận CASH hoặc BANK_TRANSFER)", HttpStatus.BAD_REQUEST),
    CHECKIN_STEP_NOT_SATISFIED(729, "Chưa thỏa mãn đầy đủ 4 điều kiện đối soát để chuyển bước", HttpStatus.BAD_REQUEST);





    private final int code;
    private final String message;
    private final HttpStatus httpStatus;

    ErrorCode(int code, String message, HttpStatus httpStatus) {
        this.code = code;
        this.message = message;
        this.httpStatus = httpStatus;
    }
}
