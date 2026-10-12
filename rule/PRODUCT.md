# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Storage Customer (Khách hàng thuê kho):** Cá nhân (chuyển nhà, lưu đồ đạc gia đình, đồ dùng theo mùa) hoặc hộ kinh doanh / doanh nghiệp vừa và nhỏ (lưu trữ hàng hóa mẫu, hồ sơ chứng từ, tồn kho) cần không gian kho tự quản an toàn, tiện lợi, linh hoạt theo diện tích và thời gian thuê.
- **Facility Staff (Nhân viên cơ sở):** Nhân viên trực tại cơ sở kho vật lý; tiếp đón khách hàng, tra cứu lịch hẹn check-in qua mã QR/SĐT, kiểm tra 4 điều kiện check-in, thực hiện checklist nghiệm thu bàn giao/trả kho (chụp và tải 2 ảnh hiện trạng), xử lý phiếu yêu cầu hỗ trợ sự cố theo ca trực.
- **Facility Manager (Quản lý cơ sở):** Quản lý sơ đồ mặt bằng và trạng thái kho vật lý, chỉ định phòng trống phù hợp, duyệt biên bản niêm phong kho nợ quá hạn, phân công ca trực nhân viên, thẩm định và phê duyệt đề xuất hoàn tiền cọc tại cơ sở.
- **Business Operations Manager (Quản lý vận hành toàn chuỗi):** Quản lý chuỗi cơ sở, danh mục loại kho (Small, Medium, Large, Climate-controlled), cấu hình chính sách giá thuê, chính sách tiền cọc, biểu phí phạt, theo dõi báo cáo doanh thu và tỷ lệ lấp đầy toàn hệ thống.
- **System Administrator (Quản trị viên hệ thống):** Quản lý danh sách tài khoản, ma trận phân quyền (RBAC), gán phạm vi cơ sở (Facility Scope) cho nhân sự và giám sát nhật ký an ninh/kiểm toán (Audit Log).

## Product Purpose

- Số hóa và chuẩn hóa toàn diện vòng đời cho thuê và vận hành chuỗi cơ sở kho tự quản (Self-Storage Facility Rental & Management).
- Khắc phục triệt để các tồn đọng của phương thức vận hành thủ công: rủi ro gán trùng kho (double-booking), thất lạc biên bản bàn giao/trả kho, theo dõi nợ trễ hạn sai sót và phân tán dữ liệu doanh thu giữa các cơ sở.
- Định nghĩa thành công: Rút ngắn thời gian bàn giao/check-in dưới 5 phút/lượt; tỷ lệ lấp đầy trung bình toàn chuỗi trên 85%; 100% lịch trình nhắc hạn/quét nợ quá hạn được tự động hóa; giảm 90% lỗi xung đột giữ chỗ.

## Positioning

Hệ thống quản lý và cho thuê kho tự quản thông minh, tập trung khép kín với cơ chế Soft-lock 24 giờ chống xung đột đặt chỗ thời gian thực, hợp đồng điện tử xác thực OTP, mã PIN mở cửa số hóa bảo mật cao bằng mã hóa AES-256-GCM (tự động kích hoạt/thu hồi theo trạng thái hợp đồng và nợ), cùng cơ chế cô lập dữ liệu theo từng cơ sở (Facility-scoped Authorization) trên nền tảng web responsive hiện đại.

## Operating Context

- Khách hàng thực hiện tìm kiếm, giữ chỗ, thanh toán trực tuyến qua máy tính hoặc điện thoại di động; sau đó đến trực tiếp cơ sở kho vật lý để hoàn tất thủ tục bàn giao nhận kho hoặc tự quản lý phòng kho qua cổng thông tin cá nhân.
- Nhân viên cơ sở sử dụng thiết bị tại quầy hoặc máy tính bảng/smartphone tại cơ sở để quét mã QR check-in, chỉ định phòng kho, kiểm tra hiện trạng vật lý (cửa cuốn, ổ khóa, ánh sáng, vệ sinh, PCCC), chụp ảnh đối chiếu trước khi bàn giao và khi nhận trả kho.
- Scheduler hệ thống quét tự động lúc 00:00 hàng ngày để gửi nhắc hạn trước 7 ngày, 3 ngày và kích hoạt quy trình xử lý nợ quá hạn đa tầng (N+1 cảnh báo, N+3 vô hiệu hóa mã PIN, N+7 niêm phong kho vật lý, N+30 chuyển hồ sơ pháp lý ngoại tuyến).
- Giao dịch tài chính (tiền cọc 100% 1 tháng và tiền thuê) đối soát tự động qua Webhook có chữ ký số (Sandbox Payment Gateway) và hoàn tiền cọc qua quy trình duyệt nghiệp vụ với SLA 3–5 ngày làm việc.

## Capabilities and Constraints

- **Capabilities:**
  - Khám phá cơ sở & loại phòng kho theo thời gian thực (ảnh, kích thước, diện tích, giá niêm yết, số lượng trống).
  - Đặt giữ chỗ trực tuyến với cơ chế Soft-lock tự động trong 24 giờ.
  - Tích hợp thanh toán trực tuyến tiền cọc và tiền thuê qua Payment Gateway Sandbox và xử lý Webhook ký số Idempotent.
  - Khởi tạo và ký kết hợp đồng điện tử bằng mã OTP gửi qua email.
  - Quy trình check-in qua mã hẹn/QR, đối soát 4 điều kiện tiên quyết và chỉ định phòng kho vật lý.
  - Checklist nghiệm thu bàn giao 5 điểm kèm tải lên 2 ảnh hiện trạng thực tế.
  - Cấp và quản lý mã PIN số hóa mở cửa kho, mã hóa đối xứng AES-256-GCM.
  - Cổng khách hàng tự quản lý phòng kho, xem mã PIN, tra cứu hóa đơn và gửi ticket hỗ trợ gắn với phòng kho.
  - Gia hạn hợp đồng trực tuyến (1, 3, 6, 12 tháng) trước hạn tối thiểu 3 ngày.
  - Scheduler quét nợ tự động theo 4 giai đoạn lũy tiến (N+1 cảnh báo, N+3 khóa PIN, N+7 niêm phong, N+30 ngoại tuyến).
  - Nghiệm thu trả kho (Check-out checklist kèm 2 ảnh), khấu trừ chi phí hư hại/vệ sinh và giải tỏa tiền cọc.
  - Cấu hình cơ sở, loại kho, biểu phí, chính sách thuê và bảng công việc hàng ngày cho nhân viên trực ca.
  - Báo cáo phân tích doanh thu, tỷ lệ lấp đầy, dư nợ quá hạn hợp nhất và theo từng cơ sở.
  - Phân quyền RBAC, cô lập dữ liệu theo cơ sở (Facility Scoping) và nhật ký kiểm toán bất biến (Audit Log).
- **Constraints (Phase 1 / MVP Bound):**
  - Không tích hợp trực tiếp phần cứng IoT điều khiển khóa từ xa qua Bluetooth/Zigbee (sử dụng mã PIN số hóa nhập trực tiếp trên bàn phím số vật lý của cửa kho).
  - Không hỗ trợ dịch vụ vận chuyển, giao nhận hàng hoặc bốc xếp đồ của bên thứ ba.
  - Không triển khai sàn đấu giá hoặc thanh lý tài sản trực tuyến (xử lý ngoại tuyến theo thủ tục pháp lý quy định).
  - Không cấp quyền tài khoản phụ (Sub-user access sharing); chỉ chủ hợp đồng mới có quyền truy cập mã PIN và quản lý kho.
  - Phân bổ phòng kho vật lý thực hiện bán tự động/thủ công bởi Staff/Manager trước giờ check-in, chưa dùng thuật toán tự động hoàn toàn.

## Brand Commitments

- **Tên thương hiệu:** Boxora — Hệ thống Quản lý và Cho thuê Cơ sở Kho Tự quản (Boxora - Self-Storage Facility Rental and Management System).
- **Đặc tính thương hiệu:** Tin cậy, an toàn, minh bạch, chuyên nghiệp, hiện đại và tiện lợi tối đa.
- **Tông giọng & Ngôn ngữ:** Tiếng Việt chuẩn mực, rõ ràng, minh bạch về điều khoản chi phí, cọc và an toàn lưu trữ; hỗ trợ song ngữ/chuẩn hóa tiếng Việt cho người dùng trong nước.

## Evidence on Hand

- `srs.txt`: Đặc tả yêu cầu phần mềm chi tiết (SRS v1.0) bao gồm 22 functional requirements (FR-001 đến FR-022), ma trận nghiệp vụ, luồng xử lý và mô hình bảo mật.
- `blueprint.md`: Software Development Blueprint hoàn chỉnh đã được phê duyệt (v1.0), bao gồm ERD data model, API contract RESTful, security model AES-256-GCM, checklist nghiệm thu bàn giao/trả kho và ma trận NFR.
- `FE/boxora-web/`: Mã nguồn Frontend React 19 + TypeScript + Vite + Tailwind CSS 4 đã scaffold với các module giao diện cho Customer, Staff, Manager, Admin.
- `BE/boxora/`: Mã nguồn Backend Java Spring Boot, Spring Security, JWT, JPA/Hibernate.
- `stitch_boxora_modern_login_portal/`: Giao diện mẫu cổng đăng nhập hiện đại Boxora thiết kế qua Stitch.

## Product Principles

1. **Minh bạch và Nhất quán Dữ liệu:** Mọi biến động về trạng thái phòng kho, hợp đồng và giao dịch tiền cọc đều phải được ghi nhận vết kiểm toán (Audit Log) rõ ràng, đối soát chính xác không sai lệch giữa thực địa và hệ thống số.
2. **An toàn Tài sản là Ưu tiên Tối thượng:** Mã PIN mở kho được bảo mật tuyệt đối với AES-256-GCM; chỉ cấp phát khi đáp ứng đầy đủ điều kiện hợp đồng và tự động thu hồi ngay khi phát sinh rủi ro quá hạn.
3. **Thủ tục Tinh gọn, Bàn giao Nhanh chóng:** Đơn giản hóa quy trình check-in và nhận kho xuống dưới 5 phút thông qua mã QR và checklist bàn giao kỹ thuật số.
4. **Cô lập Phạm vi Vận hành (Strict Facility Scoping):** Nhân sự tại cơ sở chỉ được phép xem và thao tác trên dữ liệu thuộc phạm vi cơ sở được phân công, đảm bảo tính bảo mật và độc lập vận hành giữa các chi nhánh.
5. **Chủ động Cảnh báo và Tự động hóa Vận hành:** Tự động hóa tối đa các tác vụ định kỳ (nhắc hạn, phát hiện nợ, giải phóng kho hết hạn giữ chỗ) để giảm thiểu áp lực quản lý thủ công cho nhân sự.

## Accessibility & Inclusion

- Chuẩn giao diện Web Responsive tương thích mượt mà trên cả máy tính để bàn (dành cho quản lý/nhân viên) và thiết bị di động (dành cho khách hàng và nhân viên hiện trường).
- Độ tương phản màu sắc đạt chuẩn WCAG 2.1 AA đối với các bảng biểu quản trị, trạng thái phòng kho và thông báo cảnh báo nợ/hợp đồng.
- Bố cục giao diện rõ ràng, kích thước nút bấm và khu vực tương tác thân thiện với cảm ứng trên màn hình di động khi thao tác check-in tại kho.
