export interface RoleMeta {
  title: string
  badge: string
  description: string
}

export interface PermissionMeta {
  title: string
  code: string
  description: string
}

export const ROLE_VIETNAMESE_MAP: Record<string, RoleMeta> = {
  ADMIN: {
    title: 'Quản trị viên hệ thống',
    badge: 'ADMIN',
    description: 'Toàn quyền quản trị tài khoản, vai trò người dùng, ma trận phân quyền RBAC và cấu hình bảo mật hệ thống.',
  },
  BUSINESS_MANAGER: {
    title: 'Quản lý kinh doanh',
    badge: 'BUSINESS_MANAGER',
    description: 'Quản lý danh mục cơ sở, thiết lập bảng giá, chính sách cho thuê, phê duyệt chiết khấu & khuyến mãi và báo cáo doanh thu toàn chuỗi.',
  },
  FACILITY_MANAGER: {
    title: 'Quản lý cơ sở kho',
    badge: 'FACILITY_MANAGER',
    description: 'Điều hành vận hành buồng kho, giám sát ca trực nhân viên, duyệt ngoại lệ, kiểm tra đối soát hoàn tiền và xử lý giao nhận kho tại cơ sở.',
  },
  STAFF: {
    title: 'Nhân viên trực ca',
    badge: 'STAFF',
    description: 'Thực hiện thủ tục check-in tiếp nhận kho, nghiệm thu trả kho, thu ngân quầy cơ sở, hỗ trợ khách hàng và xử lý sự cố tại chỗ.',
  },
  CUSTOMER: {
    title: 'Khách hàng thuê kho',
    badge: 'CUSTOMER',
    description: 'Khách hàng sử dụng dịch vụ lưu trữ: đặt giữ chỗ kho, thanh toán trực tuyến, ký hợp đồng điện tử và quản lý buồng kho cá nhân.',
  },
}

export const getRoleMeta = (roleName?: string, rawDesc?: string): RoleMeta => {
  const norm = (roleName || '').toUpperCase().trim()
  if (ROLE_VIETNAMESE_MAP[norm]) {
    return ROLE_VIETNAMESE_MAP[norm]
  }
  return {
    title: roleName || 'Chưa xác định',
    badge: roleName || 'ROLE',
    description: rawDesc && !/^(Store |Facility |Business )/i.test(rawDesc)
      ? rawDesc
      : 'Vai trò người dùng trong hệ thống Boxora',
  }
}

export const PERMISSION_VIETNAMESE_MAP: Record<string, { title: string; description: string }> = {
  // USER
  USER_VIEW: {
    title: 'Xem danh sách người dùng',
    description: 'Xem danh sách tài khoản, thông tin cá nhân và chi nhánh trực thuộc.',
  },
  USER_CREATE: {
    title: 'Tạo tài khoản người dùng',
    description: 'Cấp tài khoản mới cho nhân viên, quản lý hoặc khách hàng.',
  },
  USER_UPDATE: {
    title: 'Cập nhật thông tin người dùng',
    description: 'Chỉnh sửa họ tên, số điện thoại, trạng thái hoạt động hoặc phân cơ sở.',
  },
  USER_DELETE: {
    title: 'Khóa / Xóa tài khoản',
    description: 'Tạm ngưng hoạt động hoặc vô hiệu hóa tài khoản người dùng.',
  },
  USER_READ: {
    title: 'Tra cứu thông tin người dùng',
    description: 'Tra cứu chi tiết hồ sơ tài khoản trong hệ thống.',
  },
  USER_WRITE: {
    title: 'Quản trị dữ liệu người dùng',
    description: 'Thực hiện các thao tác ghi dữ liệu tài khoản người dùng.',
  },

  // ROLE & PERMISSIONS
  ROLE_VIEW: {
    title: 'Xem danh mục vai trò',
    description: 'Tra cứu danh sách các nhóm vai trò trong hệ thống.',
  },
  ROLE_CREATE: {
    title: 'Tạo vai trò mới',
    description: 'Thêm vai trò người dùng mới vào hệ thống.',
  },
  ROLE_UPDATE: {
    title: 'Cập nhật vai trò',
    description: 'Chỉnh sửa thông tin tên và mô tả vai trò.',
  },
  ROLE_DELETE: {
    title: 'Xóa vai trò',
    description: 'Xóa vai trò không còn sử dụng.',
  },
  ROLE_MANAGE: {
    title: 'Quản lý vai trò & RBAC',
    description: 'Toàn quyền quản trị cơ chế phân quyền theo vai trò.',
  },
  ROLE_PERMISSION_VIEW: {
    title: 'Xem ma trận phân quyền',
    description: 'Xem các quyền hạn chức năng được gán cho từng vai trò.',
  },
  ROLE_PERMISSION_ASSIGN: {
    title: 'Gán quyền cho vai trò',
    description: 'Cấp thêm quyền thực thi nghiệp vụ cho vai trò.',
  },
  ROLE_PERMISSION_REVOKE: {
    title: 'Thu hồi quyền của vai trò',
    description: 'Gỡ bỏ quyền thực thi nghiệp vụ khỏi vai trò.',
  },
  PERMISSION_VIEW: {
    title: 'Xem danh mục quyền hạn',
    description: 'Xem toàn bộ các mã quyền hạn trong hệ thống.',
  },
  PERMISSION_CREATE: {
    title: 'Tạo mã quyền mới',
    description: 'Định nghĩa quyền chức năng mới vào hệ thống.',
  },
  PERMISSION_UPDATE: {
    title: 'Cập nhật mã quyền',
    description: 'Chỉnh sửa tên và mô tả của quyền chức năng.',
  },
  PERMISSION_DELETE: {
    title: 'Xóa mã quyền',
    description: 'Gỡ bỏ mã quyền chức năng khỏi hệ thống.',
  },

  // FACILITY
  FACILITY_VIEW: {
    title: 'Xem danh sách cơ sở kho',
    description: 'Xem danh sách chi nhánh, địa chỉ, vị trí GPS và thông tin liên hệ.',
  },
  FACILITY_CREATE: {
    title: 'Thêm mới cơ sở kho',
    description: 'Khởi tạo cơ sở chi nhánh kho mới trong hệ thống.',
  },
  FACILITY_UPDATE: {
    title: 'Cập nhật thông tin cơ sở',
    description: 'Chỉnh sửa thông tin chi nhánh, giờ mở cửa, tiện ích và sơ đồ tầng.',
  },
  FACILITY_DELETE: {
    title: 'Xóa cơ sở kho',
    description: 'Đóng cửa hoặc gỡ bỏ thông tin chi nhánh.',
  },
  FACILITY_READ: {
    title: 'Tra cứu thông tin cơ sở',
    description: 'Tra cứu dữ liệu chi nhánh và buồng kho.',
  },

  // UNIT TYPE
  UNIT_TYPE_VIEW: {
    title: 'Xem danh mục loại buồng kho',
    description: 'Tra cứu các phân loại buồng kho (Mini, Small, Medium, Large, v.v.).',
  },
  UNIT_TYPE_CREATE: {
    title: 'Tạo phân loại buồng kho',
    description: 'Thêm loại kích thước buồng kho mới vào hệ thống.',
  },
  UNIT_TYPE_UPDATE: {
    title: 'Cập nhật loại buồng kho',
    description: 'Chỉnh sửa thông số thể tích, diện tích và mô tả buồng kho.',
  },
  UNIT_TYPE_DELETE: {
    title: 'Xóa loại buồng kho',
    description: 'Xóa phân loại buồng kho khỏi hệ thống.',
  },

  // STORAGE UNIT
  STORAGE_UNIT_VIEW: {
    title: 'Xem sơ đồ & trạng thái kho',
    description: 'Xem mặt bằng các tầng, danh sách và trạng thái từng buồng kho.',
  },
  STORAGE_UNIT_CREATE: {
    title: 'Thêm buồng kho vật lý',
    description: 'Tạo buồng kho mới trên sơ đồ tầng của chi nhánh.',
  },
  STORAGE_UNIT_UPDATE: {
    title: 'Cập nhật thông tin buồng kho',
    description: 'Cập nhật mã kho, kích thước hoặc chuyển trạng thái buồng kho.',
  },
  STORAGE_UNIT_DELETE: {
    title: 'Xóa buồng kho',
    description: 'Gỡ bỏ buồng kho vật lý khỏi sơ đồ cơ sở.',
  },
  STORAGE_UNIT_STATUS_CHANGE: {
    title: 'Đổi trạng thái buồng kho',
    description: 'Chuyển đổi trạng thái kho (Sẵn sàng, Đang thuê, Bảo trì, Niêm phong).',
  },
  STORAGE_UNIT_ASSIGN: {
    title: 'Gán buồng kho cho đơn đặt',
    description: 'Chỉ định buồng kho vật lý cụ thể cho đơn đặt giữ chỗ.',
  },
  STORAGE_UNIT_RELEASE: {
    title: 'Giải phóng buồng kho',
    description: 'Khôi phục buồng kho về trạng thái sẵn sàng đón khách khi hủy đơn/trả kho.',
  },

  // POLICY
  POLICY_VIEW: {
    title: 'Xem chính sách vận hành cơ sở',
    description: 'Xem quy định tiền cọc, giờ ra vào, thời hạn hủy đơn và phạt quá hạn.',
  },
  POLICY_CREATE: {
    title: 'Thiết lập chính sách mới',
    description: 'Tạo bộ quy chuẩn chính sách vận hành mới cho cơ sở.',
  },
  POLICY_UPDATE: {
    title: 'Cập nhật chính sách cơ sở',
    description: 'Điều chỉnh các thông số chính sách và quy chế cho thuê.',
  },
  POLICY_DELETE: {
    title: 'Xóa chính sách cơ sở',
    description: 'Hủy bỏ chính sách vận hành của cơ sở.',
  },
  POLICY_MANAGE: {
    title: 'Quản trị chính sách toàn diện',
    description: 'Toàn quyền quản lý và áp dụng chính sách toàn chuỗi.',
  },

  // BOOKING
  BOOKING_VIEW: {
    title: 'Xem đơn đặt giữ chỗ',
    description: 'Tra cứu danh sách đơn đặt kho, lịch hẹn check-in và trạng thái.',
  },
  BOOKING_CREATE: {
    title: 'Tạo đơn đặt giữ chỗ',
    description: 'Tạo đơn đặt kho mới cho khách hàng tại quầy hoặc online.',
  },
  BOOKING_UPDATE: {
    title: 'Cập nhật đơn đặt chỗ',
    description: 'Điều chỉnh thông tin đơn đặt, đổi lịch hẹn hoặc gán buồng kho.',
  },
  BOOKING_CANCEL: {
    title: 'Hủy đơn đặt giữ chỗ',
    description: 'Hủy đơn đặt kho quá hạn hoặc theo yêu cầu của khách hàng.',
  },
  RESERVATION_CREATE: {
    title: 'Tạo yêu cầu giữ chỗ',
    description: 'Tạo đơn đặt chỗ kho mới từ cổng trực tuyến.',
  },
  RESERVATION_UPDATE: {
    title: 'Cập nhật yêu cầu giữ chỗ',
    description: 'Điều chỉnh thông tin giữ chỗ và lịch hẹn tiếp đón.',
  },
  RESERVATION_CANCEL: {
    title: 'Hủy yêu cầu giữ chỗ',
    description: 'Hủy bỏ yêu cầu giữ chỗ kho của khách hàng.',
  },
  RESERVATION_EXPIRE: {
    title: 'Xử lý đơn giữ chỗ hết hạn',
    description: 'Tự động giải phóng buồng kho khi đơn giữ chỗ quá thời hạn tiếp nhận.',
  },

  // CONTRACT
  CONTRACT_VIEW: {
    title: 'Xem hợp đồng thuê kho',
    description: 'Tra cứu danh sách và chi tiết hợp đồng thuê đang hiệu lực hoặc thanh lý.',
  },
  CONTRACT_CREATE: {
    title: 'Khởi tạo hợp đồng thuê',
    description: 'Lập hợp đồng thuê buồng kho mới cho khách hàng.',
  },
  CONTRACT_UPDATE: {
    title: 'Cập nhật hợp đồng thuê',
    description: 'Điều chỉnh trạng thái, phụ lục hoặc thông tin hợp đồng thuê.',
  },
  CONTRACT_SIGNED: {
    title: 'Ký kết hợp đồng điện tử',
    description: 'Thực hiện ký số điện tử hợp đồng thuê kho.',
  },
  CONTRACT_EXTENDED: {
    title: 'Gia hạn thời hạn hợp đồng',
    description: 'Gia hạn thêm chu kỳ thuê kho trên hợp đồng hiện hữu.',
  },

  // HANDOVER
  HANDOVER_VIEW: {
    title: 'Xem biên bản giao nhận kho',
    description: 'Tra cứu biên bản check-in nhận kho và biên bản bàn giao trả kho.',
  },
  HANDOVER_CREATE: {
    title: 'Lập biên bản giao nhận kho',
    description: 'Thực hiện quy trình check-in tiếp nhận hoặc nghiệm thu hoàn trả kho.',
  },
  HANDOVER_EXECUTE: {
    title: 'Thực thi check-in & Nghiệm thu',
    description: 'Thao tác giao nhận kho, xác thực khách và kích hoạt hợp đồng.',
  },
  CHECKIN_RESCHEDULE: {
    title: 'Đổi lịch hẹn check-in',
    description: 'Ghi nhận và phê duyệt thay đổi ngày/giờ hẹn nhận kho.',
  },
  CHECKIN_VERIFIED: {
    title: 'Xác thực tiếp nhận kho',
    description: 'Kiểm tra giấy tờ CCCD/Hộ chiếu và bàn giao chìa khóa/buồng kho.',
  },
  CHECKOUT_REQUEST: {
    title: 'Yêu cầu trả buồng kho',
    description: 'Tiếp nhận và tạo yêu cầu trả kho, thanh lý hợp đồng.',
  },
  CHECKOUT_INSPECTION_COMPLETE: {
    title: 'Hoàn tất nghiệm thu trả kho',
    description: 'Kiểm tra tình trạng tài sản buồng kho và xác nhận thanh lý.',
  },
  DAMAGE_FEE_RECORDED: {
    title: 'Ghi nhận chi phí hư hại',
    description: 'Lập biên bản khấu trừ bồi thường thiệt hại buồng kho (nếu có).',
  },

  // ACCESS CREDENTIAL & MASTER KEY
  ACCESS_CREDENTIAL_VIEW: {
    title: 'Xem thông tin mã truy cập kho',
    description: 'Xem trạng thái mã PIN và mã QR truy cập cửa buồng kho.',
  },
  ACCESS_CREDENTIAL_UPDATE: {
    title: 'Cấp lại mã PIN / Mã QR',
    description: 'Tạo lại mã PIN hoặc mã QR mới cho khách hàng.',
  },
  ACCESS_CREDENTIAL_REVOKE: {
    title: 'Thu hồi quyền mở cửa kho',
    description: 'Vô hiệu hóa quyền truy cập cửa kho khi quá hạn hoặc chấm dứt hợp đồng.',
  },
  ACCESS_CREDENTIAL_ISSUE: {
    title: 'Cấp quyền truy cập mở kho',
    description: 'Khởi tạo và gửi mã PIN / QR mở khóa kho lần đầu sau check-in.',
  },
  MASTER_KEY_VIEW: {
    title: 'Xem nhật ký chìa khóa Master Key',
    description: 'Tra cứu biên bản và lịch sử mở kho khẩn cấp bằng Master Key.',
  },
  MASTER_KEY_OVERRIDE: {
    title: 'Ghi nhận mở khóa khẩn cấp (Master Key)',
    description: 'Thực hiện và ghi nhận biên bản mở khóa khẩn cấp bằng chìa khóa vạn năng.',
  },

  // PAYMENT & REFUND
  PAYMENT_VIEW: {
    title: 'Xem lịch sử thanh toán',
    description: 'Tra cứu hóa đơn, giao dịch tiền thuê, tiền cọc và thanh toán trực tuyến.',
  },
  PAYMENT_CREATE: {
    title: 'Tạo giao dịch thu tiền',
    description: 'Thu tiền thuê, tiền cọc hoặc phụ phí tại quầy và cổng thanh toán.',
  },
  PAYMENT_UPDATE: {
    title: 'Cập nhật trạng thái thanh toán',
    description: 'Đối soát và xác nhận giao dịch chuyển khoản thành công.',
  },
  PAYMENT_INITIATED: {
    title: 'Khởi tạo thanh toán trực tuyến',
    description: 'Tạo liên kết thanh toán qua cổng VNPay / ví điện tử.',
  },
  PAYMENT_CONFIRMED: {
    title: 'Xác nhận giao dịch thanh toán',
    description: 'Ghi nhận hệ thống đã nhận đủ số tiền thanh toán.',
  },
  PAYMENT_FAILED: {
    title: 'Ghi nhận thanh toán thất bại',
    description: 'Theo dõi các giao dịch lỗi hoặc thanh toán không thành công.',
  },
  PAYMENT_DUPLICATE_IGNORED: {
    title: 'Xử lý giao dịch trùng lặp',
    description: 'Hệ thống tự động bỏ qua giao dịch trùng mã.',
  },
  REFUND_VIEW: {
    title: 'Xem danh sách yêu cầu hoàn tiền',
    description: 'Tra cứu các yêu cầu hoàn cọc khi hủy đơn hoặc thanh lý hợp đồng.',
  },
  REFUND_CREATE: {
    title: 'Gửi yêu cầu hoàn tiền',
    description: 'Tạo yêu cầu hoàn cọc cho khách hàng kèm tài khoản thụ hưởng.',
  },
  REFUND_REQUEST_CREATE: {
    title: 'Tạo đơn hoàn tiền cọc',
    description: 'Tiếp nhận thông tin tài khoản ngân hàng và lập đơn hoàn tiền.',
  },
  REFUND_APPROVE: {
    title: 'Phê duyệt yêu cầu hoàn tiền',
    description: 'Quản lý cơ sở kiểm tra và duyệt giải ngân tiền hoàn trả.',
  },
  REFUND_PROCESS: {
    title: 'Xử lý chi trả hoàn tiền',
    description: 'Thực hiện chuyển khoản hoàn tiền và tải biên lai xác nhận.',
  },
  REFUND_PROCESSED: {
    title: 'Xác nhận đã giải ngân hoàn tiền',
    description: 'Ghi nhận hoàn tất chuyển tiền hoàn cọc vào tài khoản khách.',
  },
  REFUND_CONFIRM: {
    title: 'Khách hàng xác nhận tiền hoàn',
    description: 'Ghi nhận phản hồi đã nhận tiền của khách hàng.',
  },
  REFUND_RECONCILE: {
    title: 'Đối soát hoàn tiền kế toán',
    description: 'Đối chiếu dòng tiền hoàn cọc với sao kê ngân hàng.',
  },

  // RENEWAL
  RENEWAL_VIEW: {
    title: 'Xem danh sách gia hạn hợp đồng',
    description: 'Tra cứu các yêu cầu gia hạn hợp đồng thuê kho.',
  },
  RENEWAL_CREATE: {
    title: 'Tạo yêu cầu gia hạn',
    description: 'Lập phụ lục gia hạn hợp đồng thêm gói thuê mới.',
  },
  RENEWAL_APPROVE: {
    title: 'Phê duyệt gia hạn hợp đồng',
    description: 'Phê duyệt hoặc từ chối các yêu cầu gia hạn hợp đồng thuê buồng kho trong phạm vi cơ sở hoặc toàn hệ thống.',
  },
  RENEWAL_SCAN: {
    title: 'Quét nhắc nhở gia hạn tự động',
    description: 'Chạy hệ thống tự động quét và gửi email thông báo hợp đồng sắp hết hạn.',
  },
  RENEWAL_SEND: {
    title: 'Gửi email nhắc nhở gia hạn',
    description: 'Gửi email cảnh báo sắp hết hạn hợp đồng thuê kho cho khách hàng.',
  },
  RENEWAL_REQUEST: {
    title: 'Tiếp nhận yêu cầu gia hạn',
    description: 'Ghi nhận đề xuất gia hạn gói thuê từ khách hàng.',
  },
  RENEWAL_PAID: {
    title: 'Xác nhận thanh toán gia hạn',
    description: 'Ghi nhận tiền thanh toán phí gia hạn hợp đồng.',
  },
  RENEWAL_APPROVED: {
    title: 'Xác nhận duyệt gia hạn',
    description: 'Hoàn tất phê duyệt và cập nhật thời hạn hợp đồng mới.',
  },
  RENEWAL_REJECTED: {
    title: 'Từ chối yêu cầu gia hạn',
    description: 'Từ chối gia hạn kèm lý do giải thích cho khách hàng.',
  },
  RENEWAL_REACTIVATED: {
    title: 'Kích hoạt lại yêu cầu gia hạn',
    description: 'Mở lại yêu cầu gia hạn đã bị tạm hủy để khách xử lý tiếp.',
  },
  RENEWAL_APPROVAL_UNDONE: {
    title: 'Hủy quyết định phê duyệt gia hạn',
    description: 'Rút lại phê duyệt gia hạn khi có sai sót đối soát.',
  },
  RENEWAL_STAFF_ASSIGNED: {
    title: 'Phân công nhân viên hỗ trợ gia hạn',
    description: 'Giao cho nhân viên cơ sở phụ trách tiếp đón ký phụ lục tại quầy.',
  },
  RENEWAL_RECEPTION_COMPLETE: {
    title: 'Hoàn tất ký phụ lục gia hạn',
    description: 'Ký nhận phụ lục gia hạn hợp đồng thành công tại quầy.',
  },

  // SUPPORT (SỰ CỐ & HỖ TRỢ)
  SUPPORT_VIEW: {
    title: 'Xem danh sách sự cố & hỗ trợ',
    description: 'Tra cứu danh sách các phiếu yêu cầu hỗ trợ và báo cáo sự cố kỹ thuật.',
  },
  SUPPORT_CREATE: {
    title: 'Tạo phiếu báo sự cố',
    description: 'Tiếp nhận và lập phiếu yêu cầu khắc phục sự cố kỹ thuật hoặc hỗ trợ khách.',
  },
  SUPPORT_UPDATE: {
    title: 'Cập nhật tiến độ xử lý sự cố',
    description: 'Ghi nhận nhật ký xử lý, cập nhật trạng thái và giải pháp khắc phục.',
  },
  SUPPORT_ASSIGN: {
    title: 'Phân công xử lý sự cố',
    description: 'Phân công phiếu hỗ trợ và sự cố cho nhân viên trực ca phụ trách.',
  },
  SUPPORT_ESCALATE: {
    title: 'Chuyển tiếp sự cố lên cấp trên',
    description: 'Chuyển tiếp yêu cầu hỗ trợ phức tạp lên cấp Quản lý kinh doanh / Giám đốc vận hành.',
  },
  SUPPORT_CLOSE: {
    title: 'Đóng / Mở lại phiếu hỗ trợ',
    description: 'Đóng phiếu khi đã khắc phục xong hoặc mở lại khi khách yêu cầu xử lý tiếp.',
  },
  SUPPORT_RESOLVE: {
    title: 'Đánh dấu đã giải quyết sự cố',
    description: 'Xác nhận lỗi kỹ thuật đã được sửa chữa và hoạt động bình thường.',
  },
  SUPPORT_REOPEN: {
    title: 'Mở lại phiếu yêu cầu xử lý tiếp',
    description: 'Mở lại phiếu hỗ trợ theo đề nghị của khách hàng.',
  },
  SUPPORT_CONTACT_BOM: {
    title: 'Liên hệ Giám đốc Vận hành',
    description: 'Kích hoạt kênh liên lạc khẩn cấp với cấp lãnh đạo điều hành.',
  },
  SUPPORT_TICKET_CREATE: {
    title: 'Tạo phiếu sự cố buồng kho',
    description: 'Lập ticket báo cáo hỏng hóc khóa, rò rỉ hoặc điện đóm.',
  },
  SUPPORT_TICKET_UPDATE: {
    title: 'Cập nhật ticket sự cố',
    description: 'Ghi nhận tiến trình kiểm tra thực tế tại hiện trường.',
  },
  SUPPORT_TICKET_ASSIGN: {
    title: 'Phân công kỹ thuật viên',
    description: 'Giao việc xử lý hỏng hóc cho kỹ thuật viên cơ sở.',
  },
  SUPPORT_TICKET_RESOLVE: {
    title: 'Nghiệm thu khắc phục sự cố',
    description: 'Xác nhận hoàn thành sửa chữa thiết bị buồng kho.',
  },
  SUPPORT_TICKET_CLOSE: {
    title: 'Đóng phiếu sự cố kỹ thuật',
    description: 'Kết thúc quy trình xử lý ticket sự cố.',
  },
  SUPPORT_TICKET_REOPEN: {
    title: 'Xử lý lại sự cố chưa dứt điểm',
    description: 'Tiếp tục cử kỹ thuật viên kiểm tra lại theo phản ánh.',
  },
  SUPPORT_TICKET_CONTACT_BOM: {
    title: 'Báo cáo sự cố nghiêm trọng',
    description: 'Báo cáo lên cấp quản lý vận hành đối với sự cố mức độ cao.',
  },

  // HỖ TRỢ prefix variants
  'HỖ TRỢ_VIEW': {
    title: 'Xem danh sách sự cố & hỗ trợ',
    description: 'Tra cứu danh sách các phiếu yêu cầu hỗ trợ và báo cáo sự cố kỹ thuật.',
  },
  'HỖ TRỢ_CREATE': {
    title: 'Tạo phiếu báo sự cố',
    description: 'Tiếp nhận và lập phiếu yêu cầu khắc phục sự cố kỹ thuật.',
  },
  'HỖ TRỢ_UPDATE': {
    title: 'Cập nhật tiến độ sự cố',
    description: 'Ghi nhận nhật ký xử lý, cập nhật trạng thái và giải pháp khắc phục.',
  },
  'HỖ TRỢ_ASSIGN': {
    title: 'Phân công xử lý sự cố',
    description: 'Phân công phiếu hỗ trợ và sự cố cho nhân viên trực ca phụ trách.',
  },
  'HỖ TRỢ_ESCALATE': {
    title: 'Chuyển tiếp sự cố lên cấp trên',
    description: 'Chuyển tiếp yêu cầu hỗ trợ lên cấp Quản lý kinh doanh để giải quyết ngoại lệ.',
  },
  'HỖ TRỢ_CLOSE': {
    title: 'Đóng / Mở lại phiếu hỗ trợ',
    description: 'Đóng phiếu khi đã khắc phục xong hoặc mở lại khi khách hàng yêu cầu xử lý lại.',
  },

  // SEALING
  SEALING_VIEW: {
    title: 'Xem biên bản niêm phong kho',
    description: 'Xem biên bản niêm phong buồng kho quá hạn nợ cước (BR-RULE-012).',
  },
  SEALING_CREATE: {
    title: 'Lập biên bản niêm phong kho',
    description: 'Lập biên bản niêm phong kho quá hạn nợ cước theo quy chuẩn vận hành (BR-RULE-012).',
  },
  SEALING_UNSEAL: {
    title: 'Mở niêm phong kho',
    description: 'Mở niêm phong kho sau khi khách hàng đã thanh toán đầy đủ nợ cước (BR-RULE-012).',
  },
  OVERDUE_DETECTED: {
    title: 'Phát hiện hợp đồng quá hạn',
    description: 'Hệ thống tự động ghi nhận đơn quá hạn thanh toán.',
  },
  OVERDUE_REMINDER_SENT: {
    title: 'Đã gửi nhắc nhở nợ cước',
    description: 'Ghi nhận email thông báo nhắc nợ gửi tới khách hàng.',
  },
  OVERDUE_ACCESS_DISABLED: {
    title: 'Khóa quyền truy cập quá hạn',
    description: 'Tạm khóa mã PIN và mã QR khi quá hạn ngày thứ 3.',
  },
  OVERDUE_SEALING_APPROVED: {
    title: 'Phê duyệt niêm phong kho',
    description: 'Quản lý duyệt lệnh niêm phong vật lý buồng kho.',
  },
  OVERDUE_UNIT_LOCKED: {
    title: 'Khóa niêm phong vật lý',
    description: 'Ghi nhận hoàn tất dán tem niêm phong buồng kho quá hạn.',
  },

  // PRICING, DISCOUNT, FEE
  PRICE_VIEW: {
    title: 'Xem bảng giá thuê kho',
    description: 'Tra cứu ma trận đơn giá cho thuê buồng kho theo khu vực.',
  },
  PRICING_VIEW: {
    title: 'Xem bảng giá thuê kho',
    description: 'Tra cứu ma trận đơn giá cho thuê buồng kho theo khu vực.',
  },
  PRICE_ADJUST: {
    title: 'Điều chỉnh bảng giá thuê',
    description: 'Thiết lập và điều chỉnh ma trận đơn giá cho thuê buồng kho theo khu vực và diện tích.',
  },
  PRICING_UPDATE: {
    title: 'Cập nhật bảng giá thuê',
    description: 'Thiết lập và cập nhật ma trận đơn giá cho thuê buồng kho.',
  },
  PRICE_HISTORY_VIEW: {
    title: 'Xem lịch sử thay đổi giá kho',
    description: 'Xem nhật ký và lịch sử các lần điều chỉnh đơn giá kho (BR-RULE-011).',
  },
  DISCOUNT_VIEW: {
    title: 'Xem danh mục khuyến mãi',
    description: 'Tra cứu các mã giảm giá và chương trình chiết khấu.',
  },
  DISCOUNT_CREATE: {
    title: 'Tạo chương trình khuyến mãi',
    description: 'Thiết lập mã giảm giá và mức chiết khấu theo thời hạn thuê.',
  },
  DISCOUNT_UPDATE: {
    title: 'Cập nhật khuyến mãi',
    description: 'Chỉnh sửa điều kiện áp dụng hoặc thời hạn của mã giảm giá.',
  },
  DISCOUNT_DELETE: {
    title: 'Xóa khuyến mãi',
    description: 'Ngưng áp dụng hoặc gỡ bỏ chương trình khuyến mãi.',
  },
  DISCOUNT_ACTIVATE: {
    title: 'Kích hoạt chương trình khuyến mãi',
    description: 'Mở áp dụng mã giảm giá cho khách hàng.',
  },
  DISCOUNT_DEACTIVATE: {
    title: 'Tạm ngưng chương trình khuyến mãi',
    description: 'Dừng áp dụng mã giảm giá.',
  },
  FEE_VIEW: {
    title: 'Xem biểu phí & phụ phí',
    description: 'Tra cứu danh mục các loại phí dịch vụ, tiền cọc và phí phạt.',
  },
  FEE_CREATE: {
    title: 'Thêm loại phụ phí mới',
    description: 'Khởi tạo loại phí dịch vụ phát sinh mới.',
  },
  FEE_UPDATE: {
    title: 'Cập nhật biểu phí',
    description: 'Chỉnh sửa mức phí dịch vụ và phụ phí.',
  },
  FEE_DELETE: {
    title: 'Xóa loại phụ phí',
    description: 'Gỡ bỏ loại phụ phí khỏi danh mục biểu phí.',
  },
  FEE_WAIVE: {
    title: 'Miễn giảm phụ phí ngoại lệ',
    description: 'Phê duyệt miễn giảm chi phí phát sinh cho khách hàng.',
  },

  // REPORT & AUDIT
  REPORT_VIEW: {
    title: 'Xem báo cáo thống kê',
    description: 'Tra cứu các báo cáo hoạt động, công suất kho và hiệu quả vận hành.',
  },
  REPORT_REVENUE: {
    title: 'Xem báo cáo doanh thu',
    description: 'Xem tổng hợp doanh thu tiền thuê, tiền cọc và nợ cước toàn chuỗi.',
  },
  REPORT_EXPORT: {
    title: 'Xuất dữ liệu báo cáo',
    description: 'Xuất dữ liệu báo cáo ra định dạng bảng tính Excel / CSV.',
  },
  AUDIT_LOG_READ: {
    title: 'Xem nhật ký kiểm toán hệ thống',
    description: 'Tra cứu chi tiết các hành động truy cập, thao tác và lịch sử đăng nhập.',
  },
  AUDIT_VIEW: {
    title: 'Xem nhật ký kiểm toán',
    description: 'Tra cứu chi tiết các hành động truy cập, thao tác và đăng nhập.',
  },

  // STAFF ASSIGNMENT & SHIFT
  STAFF_ASSIGNMENT_VIEW: {
    title: 'Xem phân công ca trực',
    description: 'Tra cứu lịch trực ca của nhân viên tại các chi nhánh cơ sở.',
  },
  STAFF_ASSIGNMENT_CREATE: {
    title: 'Xếp lịch trực ca nhân viên',
    description: 'Phân công nhân viên vào các ca trực tại cơ sở kho.',
  },
  STAFF_ASSIGNMENT_UPDATE: {
    title: 'Cập nhật lịch trực ca',
    description: 'Điều chỉnh lịch trực ca hoặc phê duyệt yêu cầu đổi ca.',
  },
  STAFF_ASSIGNMENT_REMOVE: {
    title: 'Hủy phân công ca trực',
    description: 'Gỡ bỏ lịch phân công trực ca của nhân viên.',
  },
  SHIFT_HANDOVER_VIEW: {
    title: 'Xem sổ giao ca trực',
    description: 'Tra cứu biên bản bàn giao ca, quỹ tiền mặt và tài sản cơ sở.',
  },
  SHIFT_HANDOVER_EXECUTE: {
    title: 'Bàn giao & Ký nhận ca trực',
    description: 'Lập biên bản bàn giao ca trực và ký nhận quỹ tiền mặt quầy.',
  },
}

export const formatPermission = (perm: { name?: string; code?: string; description?: string }): PermissionMeta => {
  const code = (perm.code || perm.name || '').trim()
  const normKey = code.toUpperCase().replace(/\s+/g, '_')

  if (PERMISSION_VIETNAMESE_MAP[normKey]) {
    return {
      title: PERMISSION_VIETNAMESE_MAP[normKey].title,
      code,
      description: PERMISSION_VIETNAMESE_MAP[normKey].description,
    }
  }

  // Check fallback match by name
  const nameNorm = (perm.name || '').toUpperCase().replace(/\s+/g, '_')
  if (PERMISSION_VIETNAMESE_MAP[nameNorm]) {
    return {
      title: PERMISSION_VIETNAMESE_MAP[nameNorm].title,
      code,
      description: PERMISSION_VIETNAMESE_MAP[nameNorm].description,
    }
  }

  // Automatic translation fallback for unknown permissions
  let generatedTitle = perm.name || code
  let generatedDesc = perm.description || 'Thực hiện thao tác quyền hạn được chỉ định trong hệ thống.'

  // Replace mixed Vietnamese/English words
  generatedTitle = generatedTitle
    .replace(/^HỖ TRỢ_/i, 'Hỗ trợ: ')
    .replace(/_VIEW$/i, ' (Xem)')
    .replace(/_CREATE$/i, ' (Tạo mới)')
    .replace(/_UPDATE$/i, ' (Cập nhật)')
    .replace(/_DELETE$/i, ' (Xóa)')
    .replace(/_APPROVE$/i, ' (Phê duyệt)')

  // If description has pure English words, clean them
  if (generatedDesc.includes('within facility or chain-wide')) {
    generatedDesc = 'Thực thi nghiệp vụ trong phạm vi cơ sở hoặc toàn hệ thống.'
  } else if (generatedDesc.includes('Assign support tickets to staff')) {
    generatedDesc = 'Phân công phiếu hỗ trợ và sự cố cho nhân viên trực ca.'
  } else if (generatedDesc.includes('Escalate support tickets')) {
    generatedDesc = 'Chuyển tiếp yêu cầu hỗ trợ lên cấp Quản lý kinh doanh.'
  } else if (generatedDesc.includes('Close or reopen')) {
    generatedDesc = 'Đóng hoặc mở lại các phiếu hỗ trợ do tài khoản phụ trách.'
  } else if (generatedDesc.includes('View master key override')) {
    generatedDesc = 'Xem nhật ký và biên bản mở khóa khẩn cấp bằng Master Key.'
  } else if (generatedDesc.includes('Record emergency master key use')) {
    generatedDesc = 'Ghi nhận và thực hiện mở khóa khẩn cấp bằng Master Key.'
  }

  return {
    title: generatedTitle,
    code,
    description: generatedDesc,
  }
}

