# Bộ Prompt Thiết Kế Giao Diện Stitch MCP Theo Từng Chức Năng (FR-001 -> FR-022)

**Project:** Boxora - Self-Storage Facility Rental and Management System (Hệ thống Quản lý và Cho thuê Cơ sở Kho Tự quản)  
**Tài liệu tham chiếu:** [blueprint.md](file:///c:/Users/Phuc/Documents/WS_01_FU-main/WS_01_FU-main/blueprint.md) | [srs.txt](file:///c:/Users/Phuc/Documents/WS_01_FU-main/WS_01_FU-main/srs.txt) | [stitch-ui-design.prompt.md](file:///c:/Users/Phuc/Documents/WS_01_FU-main/WS_01_FU-main/.github/prompts/stitch-ui-design.prompt.md)  
**Công cụ thực thi:** Stitch MCP (`generate_screen_from_text`, `generate_variants`, `edit_screens`, `create_design_system`)  
**Mô hình AI:** `GEMINI_3_8_FLASH`  

---

## 🎨 Quy chuẩn Thiết kế Chung (Boxora Design System Guidelines)

- **Tone & Mood:** Công nghiệp hiện đại (Modern Industrial Storage), sạch sẽ, trực quan, tin cậy, bảo mật cao.
- **Bảng màu chủ đạo (Color Palette):**
  - **Màu nền (Background):** Nền sáng chuẩn doanh nghiệp (`#F8FAFC` - Slate 50) hoặc Dark mode điều hành (`#0F172A` - Slate 900). Thẻ Card trắng tinh khôi (`#FFFFFF`) hoặc Slate 800 (`#1E293B`).
  - **Màu thương hiệu chính (Primary):** Xanh Navy đậm uy tín (`#1E3A8A` - Blue 900) kết hợp Xanh biển hiện đại (`#2563EB` - Blue 600).
  - **Màu điểm nhấn (Accent / Action):** Cam bảo hộ công nghiệp (`#EA580C` - Orange 600) cho nút Đặt chỗ / Cảnh báo; Xanh lục (`#16A34A` - Green 600) cho Trạng thái phòng trống (Available) và Đã thanh toán.
  - **Trạng thái phòng kho (Storage Unit Status Badges):**
    - `Available`: Xanh lá cây nhạt (`#DCFCE7`), chữ xanh lá đậm (`#166534`).
    - `Reserved`: Vàng hổ phách (`#FEF3C7`), chữ nâu cam (`#92400E`).
    - `Occupied`: Xanh dương nhạt (`#DBEAFE`), chữ xanh dương đậm (`#1E40AF`).
    - `Overdue_Locked`: Đỏ nhạt (`#FEE2E2`), chữ đỏ thẫm (`#991B1B`).
    - `Maintenance / Cleaning`: Xám nhạt (`#F1F5F9`), chữ xám đậm (`#475569`).
- **Typography:** `Inter` hoặc `Plus Jakarta Sans`, kích thước phân cấp khoa học (H1 28px Bold, H2 22px Semibold, Body 14px Regular, Caption 12px Medium).
- **Thành phần tương tác:** Bo góc mềm (`rounded-xl` 12px), bóng đổ nhẹ nhàng (`shadow-sm`, `shadow-md`), viền mỏng tinh tế (`border-slate-200`).

---

## 📱 Danh mục Prompt Chi tiết theo Từng Yêu cầu Chức năng (FR-001 -> FR-022)

### [FR-001] Hiển thị danh mục cơ sở, loại kho, giá và số phòng trống
- **Target Role:** Guest, Storage Customer
- **Device Type:** `DESKTOP` & `MOBILE`
- **Stitch MCP Prompt:**
> "Thiết kế màn hình Danh mục Cơ sở và Phòng kho khả dụng (Storage Discovery & Catalog) cho khách hàng của Boxora. Header gồm logo Boxora, thanh điều hướng [Trang chủ | Tìm kho | Bảng giá | Hướng dẫn | Đăng nhập/Đăng ký]. Thanh tìm kiếm nổi bật cho phép lọc theo Thành phố (Hà Nội, TP.HCM, Đà Nẵng), Quận/Huyện, Loại diện tích [Small 3-5m² | Medium 8-12m² | Large 15-25m²] và Khoảng giá. Phần nội dung chính hiển thị dạng Lưới thẻ cơ sở (Facility Cards): Mỗi cơ sở hiển thị ảnh đại diện chất lượng cao, tên cơ sở, địa chỉ kèm icon chỉ đường, tiện ích (Camera 24/7, Máy lạnh kiểm soát nhiệt ẩm, Thang máy nâng hàng). Bên dưới là danh sách các loại phòng kho kèm hình ảnh 3D minh họa, kích thước (Dài x Rộng x Cao), giá thuê niêm yết theo tháng (VND/tháng), huy hiệu số lượng phòng còn trống 'Còn 5 phòng trống' màu xanh lá và nút CTA 'Xem chi tiết & Đặt chỗ'."

---

### [FR-002] Khách hàng chọn cơ sở, loại kho, ngày thuê và tạo đơn đặt giữ chỗ
- **Target Role:** Storage Customer
- **Device Type:** `DESKTOP`
- **Stitch MCP Prompt:**
> "Thiết kế màn hình Tạo đơn đặt giữ chỗ kho tự quản (Storage Unit Reservation Form) cho Khách hàng. Bố cục 2 cột (Layout 60/40): Cột bên trái là Form đặt chỗ gồm: Tên cơ sở đã chọn, loại kho đã chọn kèm thông số kích thước và tiện ích, chọn Ngày bắt đầu thuê (Date picker), chọn Thời hạn thuê bằng thanh trượt hoặc radio buttons [1 tháng | 3 tháng | 6 tháng | 12 tháng - Giảm 5%], trường ghi chú đặc biệt. Cột bên phải là Thẻ tóm tắt chi phí (Sticky Order Summary Card): Tiền thuê tháng đầu, Tiền đặt cọc (100% tiền thuê 1 tháng theo chính sách BR-RULE-002), Giảm giá khuyến mãi (nếu có), Tổng số tiền thanh toán ban đầu. Thông báo nổi bật 'Giữ chỗ tự động 24 giờ kể từ lúc đặt' kèm nút bấm CTA lớn 'Tiến hành đặt giữ chỗ'."

---

### [FR-003] Tích hợp thanh toán tiền cọc, tiền thuê và đối soát Webhook
- **Target Role:** Storage Customer
- **Device Type:** `DESKTOP` & `MOBILE`
- **Stitch MCP Prompt:**
> "Thiết kế màn hình Thanh toán Đơn đặt chỗ (Checkout & Payment Gateway Portal) cho Boxora. Hiển thị mã đơn đặt chỗ 'RES-2026-8891' và đồng hồ đếm ngược thời gian thanh toán còn lại trong 24 giờ. Bảng chi tiết thanh toán gồm: Tiền đặt cọc (1 tháng) và Tiền thuê kỳ đầu tiên. Các phương thức thanh toán Sandbox: [Quét mã QR Ngân hàng / VNPay Sandbox | Thẻ ATM Nội địa | Thẻ Quốc tế Visa/Mastercard]. Khi chọn Quét mã QR, hiển thị khung mã QR thanh toán động lớn ở trung tâm, số tài khoản nhận, số tiền chính xác và nội dung chuyển khoản tự động. Phía dưới có thanh tiến trình trạng thái 'Đang chờ cổng thanh toán xác nhận...' và nút 'Tôi đã chuyển khoản thành công'."

---

### [FR-004] Cơ chế giữ chỗ tạm thời (Soft-lock) 24 giờ và tự động giải phóng tồn kho
- **Target Role:** Storage Customer
- **Device Type:** `DESKTOP`
- **Stitch MCP Prompt:**
> "Thiết kế màn hình Chi tiết Đơn đặt chỗ Chờ thanh toán với Đồng hồ đếm ngược Soft-lock 24 giờ. Header hiển thị biểu tượng đồng hồ cát với thông báo: 'Đơn đặt chỗ của bạn đang được giữ kho trong: 23 giờ 45 phút 12 giây'. Thông tin chi tiết: Loại phòng kho đang được giữ, cơ sở lưu trữ, ngày bắt đầu thuê dự kiến. Nút bấm 'Thanh toán ngay để xác nhận' màu cam nổi bật và nút phụ 'Hủy đơn giữ chỗ'. Có mục cảnh báo: 'Nếu không hoàn tất thanh toán trước thời hạn đếm ngược, đơn hàng sẽ tự động hủy và phòng kho sẽ được mở lại cho khách hàng khác'."

---

### [FR-005] Khách hàng đặt lịch hẹn check-in và sinh mã tra cứu / QR Code
- **Target Role:** Storage Customer
- **Device Type:** `MOBILE` & `DESKTOP`
- **Stitch MCP Prompt:**
> "Thiết kế màn hình 'Đặt lịch hẹn nhận kho & Thẻ Check-in Điện tử' cho khách hàng sau khi thanh toán thành công và ký E-contract. Bước 1: Khách chọn Ngày và Khung giờ đến nhận kho (Time slots: 08:30-09:30, 09:30-10:30, 14:00-15:00,...). Bước 2: Sau khi xác nhận, sinh Thẻ Check-in Điện tử dạng thẻ vé boarding pass cao cấp: Chứa Mã QR Check-in khổ lớn, Mã đặt chỗ dạng số 'RES-8891', Họ tên khách hàng, Số CCCD (đã che 4 số cuối), Tên cơ sở kho kèm bản đồ vị trí, nút 'Lưu vé vào Apple Wallet / Tải ảnh QR' và 'Xem hướng dẫn khi đến cơ sở'."

---

### [FR-006] Nhân viên tra cứu đơn đặt chỗ bằng mã QR hoặc số điện thoại
- **Target Role:** Facility Staff
- **Device Type:** `TABLET` & `DESKTOP`
- **Stitch MCP Prompt:**
> "Thiết kế màn hình 'Tra cứu & Tiếp đón Check-in tại quầy' dành cho Nhân viên cơ sở trên Tablet/Desktop. Thanh công cụ đầu trang có 2 chế độ: Nút 'Quét mã QR từ Camera' và Thanh tìm kiếm nhanh bằng SĐT khách hàng hoặc Mã đặt chỗ. Bên dưới là kết quả tìm kiếm hiển thị dạng Card hồ sơ khách hàng: Avatar, Họ tên, SĐT, Mã đặt chỗ, Loại kho, Thời hạn thuê. Khu vực kiểm tra nhanh 4 điều kiện nhận kho dạng checklist có biểu tượng màu trực quan: [x] Đã nộp 100% cọc, [x] Đã nộp tiền thuê tháng đầu, [x] Đã ký E-contract qua OTP, [ ] Chưa đối chiếu CCCD gốc. Kèm nút bấm lớn 'Bắt đầu thủ tục bàn giao'."

---

### [FR-007] Nhân viên/Quản lý cơ sở chỉ định phòng kho vật lý cụ thể cho đơn booking
- **Target Role:** Facility Manager, Facility Staff
- **Device Type:** `DESKTOP`
- **Stitch MCP Prompt:**
> "Thiết kế màn hình Sơ đồ Mặt bằng Kho & Chỉ định Phòng kho vật lý (Facility Floor Map & Unit Assignment) cho Quản lý cơ sở. Thanh điều khiển trên cùng cho phép chọn Tầng (Tầng 1, Tầng 2, Tầng 3), lọc trạng thái phòng kho (Trống, Đã gán, Đang thuê, Bảo trì). Khu vực chính là Sơ đồ mặt bằng tương tác (Interactive Floor Grid Map): Mỗi phòng kho là một khối hộp có mã số (ví dụ: A-101, A-102, B-205) với màu sắc theo trạng thái. Khi click vào đơn đặt chỗ chưa gán phòng ở bảng trượt bên trái, hệ thống làm nổi bật các phòng Available đúng loại kho trên sơ đồ. Bấm chọn phòng vật lý sẽ hiện popup xác nhận: 'Chỉ định phòng A-105 (Loại Medium) cho khách hàng Nguyễn Văn A?' kèm nút 'Xác nhận gán phòng'."

---

### [FR-008] Đối soát 4 điều kiện, checklist nghiệm thu, cấp mã PIN AES-256 và Occupied
- **Target Role:** Facility Staff
- **Device Type:** `MOBILE` & `TABLET`
- **Stitch MCP Prompt:**
> "Thiết kế màn hình Nghiệm thu Bàn giao Kho vật lý (Handover & Unit Inspection Checklist) cho Nhân viên trực ca trên điện thoại/máy tính bảng. Header hiển thị: Mã phòng kho A-105, Tên khách hàng. Phần 1: Bắt buộc xác minh CCCD gốc (nút switch bật/tắt). Phần 2: Checklist tình trạng phòng kho 5 điểm: [Cửa kho đóng mở trơn tru | Ổ khóa hoạt động tốt | Sàn kho khô ráo sạch sẽ | Đèn trần hoạt động | Không có dấu hiệu ẩm mốc/hư hại]. Phần 3: Khu vực tải ảnh hiện trạng: Bắt buộc tối thiểu 2 ảnh (Ảnh tổng quan phòng và Ảnh cận cảnh ổ khóa) có hiển thị timestamp. Phần 4: Nút CTA 'Hoàn tất bàn giao & Cấp mã mở cửa'. Khi bấm thành công, màn hình chuyển sang thông báo thành công: Trạng thái kho chuyển Occupied, hợp đồng Active và hệ thống đã sinh mã PIN bảo mật cấp cho khách."

---

### [FR-009] Màn hình 'Kho của tôi' xem hợp đồng, mã PIN mở cửa và lịch sử hóa đơn
- **Target Role:** Storage Customer
- **Device Type:** `MOBILE` & `DESKTOP`
- **Stitch MCP Prompt:**
> "Thiết kế màn hình Cổng quản lý 'Kho của tôi' (My Rented Storage Units Dashboard) cho Khách hàng. Danh sách các phòng kho đang thuê hiển thị dạng Card trực quan: Mã phòng kho (ví dụ: B-204, Kho Tân Bình), Loại diện tích, Ngày bắt đầu và Ngày hết hạn hợp đồng kèm thanh tiến trình thời gian thuê. Khung mở mã PIN bảo mật: Mặc định hiển thị dạng ẩn `******` có icon con mắt, khi bấm 'Xem mã PIN' sẽ yêu cầu xác thực bảo mật và hiển thị mã số PIN 6 chữ số kèm ghi chú an toàn. Bên dưới có các nút thao tác nhanh: [Gia hạn hợp đồng | Yêu cầu trả kho | Báo sự cố/Hỗ trợ | Xem hợp đồng điện tử PDF]."

---

### [FR-010] Khách hàng tạo phiếu yêu cầu hỗ trợ sự cố gắn với phòng kho đang thuê
- **Target Role:** Storage Customer
- **Device Type:** `MOBILE` & `DESKTOP`
- **Stitch MCP Prompt:**
> "Thiết kế màn hình 'Gửi Phiếu Yêu Cầu Hỗ Trợ Sự Cố' (Submit Support Ticket) cho Khách hàng thuê kho Boxora. Form gồm: Dropdown chọn phòng kho đang thuê (Ví dụ: Kho A-102 - Cơ sở Quận 7), Dropdown chọn Danh mục sự cố [Kẹt cửa/Khóa số không nhận | Đèn chiếu sáng hỏng | Vấn đề vệ sinh/mùi hôi | Nhiệt độ/độ ẩm bất thường | Yêu cầu khác], Chọn mức độ khẩn cấp [Bình thường | Khẩn cấp], Nhập Tiêu đề và Mô tả chi tiết vấn đề, Khung tải ảnh/video đính kèm hiện trường sự cố. Nút bấm CTA 'Gửi yêu cầu hỗ trợ'. Phía dưới có danh sách các phiếu hỗ trợ đã gửi kèm nhãn trạng thái [Đang xử lý | Đã giải quyết]."

---

### [FR-011] Bảng công việc hàng ngày tổng hợp lịch nhận/trả kho và ticket cho nhân viên
- **Target Role:** Facility Staff
- **Device Type:** `DESKTOP`
- **Stitch MCP Prompt:**
> "Thiết kế Bảng công việc trực ca hàng ngày (Staff Daily Operations Task Board) cho Nhân viên cơ sở trên Desktop. Thanh đầu trang hiển thị Tên cơ sở hiện tại, ngày làm việc hôm nay và 3 thẻ tóm tắt nhanh: [5 Lượt nhận kho hôm nay | 2 Lượt trả kho hôm nay | 3 Phiếu hỗ trợ chờ xử lý]. Bố cục dạng 3 cột Kanban công việc: Cột 1 'Khách đến nhận kho' hiển thị danh sách giờ hẹn, tên khách, loại kho, nút 'Check-in ngay'. Cột 2 'Khách làm thủ tục trả kho' hiển thị giờ hẹn trả kho, mã phòng cần nghiệm thu, nút 'Kiểm tra trả kho'. Cột 3 'Sự cố cần hỗ trợ tại cơ sở' hiển thị các ticket mở, mức độ ưu tiên, số phòng và nút 'Xử lý ngay'."

---

### [FR-012] Nhân viên cơ sở tiếp nhận, cập nhật tiến độ xử lý và đóng phiếu hỗ trợ
- **Target Role:** Facility Staff, Facility Manager
- **Device Type:** `DESKTOP`
- **Stitch MCP Prompt:**
> "Thiết kế màn hình 'Chi tiết & Xử lý Phiếu Hỗ trợ Sự cố' (Support Ticket Detail & Resolution Drawer) cho Nhân viên cơ sở. Cột thông tin ticket: Mã ticket `#TCK-1092`, Khách hàng, SĐT, Phòng kho liên quan, Cơ sở, Thời gian gửi, Danh mục sự cố, Ảnh chụp của khách. Khu vực xử lý: Người phụ trách (Staff assignee dropdown), Dropdown đổi trạng thái [Open -> In Progress -> Resolved -> Closed]. Hộp thoại ghi chú xử lý nội bộ và ghi chú gửi phản hồi cho khách. Nút 'Hoàn tất & Đóng phiếu hỗ trợ'."

---

### [FR-013] Tự động gửi thông báo nhắc gia hạn hợp đồng trước 7 ngày và 3 ngày
- **Target Role:** Storage Customer
- **Device Type:** `EMAIL & IN-APP NOTIFICATION`
- **Stitch MCP Prompt:**
> "Thiết kế Mẫu Email và Thông báo In-App 'Nhắc nhở gia hạn hợp đồng thuê kho Boxora' gửi tự động trước 7 ngày và 3 ngày. Banner thương hiệu Boxora chuyên nghiệp. Tiêu đề: 'Hợp đồng thuê kho A-205 của bạn sắp hết hạn sau 7 ngày'. Nội dung tóm tắt: Mã hợp đồng, Mã phòng kho, Địa chỉ cơ sở, Ngày hết hạn hợp đồng. Hướng dẫn các lựa chọn: [Gia hạn trực tuyến ngay với ưu đãi giữ nguyên giá thuê | Yêu cầu trả kho và đặt lịch kiểm tra]. Nút bấm CTA lớn 'Gia hạn hợp đồng ngay' và cảnh báo: 'Gia hạn online đóng trước ngày hết hạn 3 ngày. Vui lòng thanh toán sớm để không bị gián đoạn quyền truy cập mã PIN'."

---

### [FR-014] Khách hàng gia hạn hợp đồng trực tuyến và thanh toán trước hạn >= 3 ngày
- **Target Role:** Storage Customer
- **Device Type:** `DESKTOP` & `MOBILE`
- **Stitch MCP Prompt:**
> "Thiết kế màn hình 'Gia hạn Hợp đồng Thuê kho Trực tuyến' (Online Contract Renewal) cho Khách hàng. Hiển thị thông tin hợp đồng hiện tại: Phòng B-102, Giá thuê đang áp dụng (đã khóa cố định), Ngày hết hạn cũ. Bước 1: Chọn gói gia hạn [1 tháng | 3 tháng - Giảm 3% | 6 tháng - Giảm 5% | 12 tháng - Giảm 10%]. Hệ thống tính ngày hết hạn mới và số tiền cần thanh toán. Bước 2: Chọn phương thức thanh toán trực tuyến. Bước 3: Nút 'Thanh toán gia hạn'. Khi thanh toán thành công, hiển thị trang chúc mừng với ngày hết hạn mới đã được cập nhật và quyền truy cập mã PIN được duy trì liên tục."

---

### [FR-015] Kiểm tra hiện trạng trả kho, tải tối thiểu 2 ảnh và tính phí hư hại/vệ sinh
- **Target Role:** Facility Staff, Storage Customer
- **Device Type:** `TABLET` & `DESKTOP`
- **Stitch MCP Prompt:**
> "Thiết kế màn hình Biên bản Nghiệm thu Trả kho (Checkout Inspection Form) cho Nhân viên cơ sở. Header gồm: Mã hợp đồng, Mã phòng kho, Tên khách hàng trả kho. Phần 1: Checklist kiểm tra 5 tiêu chí trả kho: [Khách đã dọn sạch toàn bộ tài sản | Sàn kho sạch sẽ không rác thải | Ổ khóa và bản lề nguyên vẹn | Tường/vách kho không bị trầy xước thủng lỗ | Không có mùi hôi hoặc hóa chất lưu lại]. Phần 2: Ghi nhận phụ phí khấu trừ nếu vi phạm (Phí dọn vệ sinh, Phí sửa chữa hư hại, Phí trễ hạn). Phần 3: Bắt buộc tải lên tối thiểu 2 ảnh hiện trạng thực tế khi trả phòng. Nút 'Lưu biên bản & Tính tiền cọc thực hoàn'."

---

### [FR-016] Tự động tính cọc thực hoàn và luồng duyệt hoàn tiền theo SLA 3–5 ngày
- **Target Role:** Facility Manager, Facility Staff
- **Device Type:** `DESKTOP`
- **Stitch MCP Prompt:**
> "Thiết kế màn hình 'Quyết toán & Phê duyệt Hoàn tiền Cọc' (Deposit Refund Approval Screen) cho Quản lý cơ sở. Bảng tóm tắt công thức hoàn cọc trực quan: [Tiền cọc ban đầu: 3,000,000 VND] - [Phí vệ sinh: 200,000 VND] - [Phí hư hại: 0 VND] - [Phí nợ quá hạn: 0 VND] = [Số tiền cọc thực nhận: 2,800,000 VND]. Hiển thị thông tin tài khoản ngân hàng nhận hoàn cọc của khách hàng. Khung ảnh đối chứng hiện trạng trả kho. Nút bấm 'Phê duyệt hoàn cọc & Chuyển kế toán' và ô nhập ghi chú phê duyệt. Thông báo SLA cam kết hoàn tất giải ngân trong 3–5 ngày làm việc."

---

### [FR-017] Tác vụ quét nợ hàng ngày lúc 00:00, tính phạt trễ hạn và khóa PIN ngày N+3
- **Target Role:** Storage Customer, Facility Manager
- **Device Type:** `MOBILE` & `DESKTOP`
- **Stitch MCP Prompt:**
> "Thiết kế Banner Cảnh báo Nợ quá hạn & Màn hình Trạng thái Khóa phòng (Overdue Lock Notice). Giao diện hiển thị tông màu cảnh báo Đỏ/Cam khẩn cấp. Thông báo lớn: 'Phòng kho B-302 của bạn đã bị khóa mã PIN do quá hạn thanh toán 3 ngày'. Bảng chi tiết nợ: Tiền thuê kỳ mới chưa nộp, Phí phạt trễ hạn tính theo ngày (50,000 VND/ngày). Huy hiệu trạng thái mã PIN: 'REVOKED / ĐÃ VÔ HIỆU HÓA'. Nút bấm CTA khẩn cấp 'Thanh toán nợ & Mở lại quyền truy cập ngay'. Kèm số điện thoại hotline hỗ trợ khẩn cấp của Quản lý cơ sở."

---

### [FR-018] Quản lý cơ sở duyệt niêm phong kho vật lý ngày N+7 và pháp lý ngày N+30
- **Target Role:** Facility Manager
- **Device Type:** `DESKTOP`
- **Stitch MCP Prompt:**
> "Thiết kế màn hình 'Xử lý Nợ Xấu & Lệnh Niêm phong Phòng kho' (Overdue Unit Sealing Workflow) dành cho Quản lý cơ sở. Danh sách các phòng kho quá hạn >= 7 ngày. Chi tiết từng ca nợ: Số ngày quá hạn, Tổng tiền nợ tồn đọng, Lịch sử liên hệ khách hàng (gọi điện, email cảnh báo). Nút hành động 'Phê duyệt Lệnh Niêm phong Vật lý'. Khi bấm, mở Modal xác nhận: Nhập tên nhân viên thực hiện khóa niêm phong ngoài, tải biên bản niêm phong có chữ ký 2 người, và xác nhận chuyển trạng thái phòng sang 'Overdue_Locked (Sealed)'. Tab theo dõi các hồ sơ quá hạn > 30 ngày để xuất biên bản chuyển cơ quan pháp lý ngoại tuyến."

---

### [FR-019] Business Operations Manager cấu hình cơ sở, loại kho, giá và chính sách
- **Target Role:** Business Operations Manager
- **Device Type:** `DESKTOP`
- **Stitch MCP Prompt:**
> "Thiết kế màn hình Quản trị Bảng giá, Danh mục Loại kho & Chính sách Vận hành (Pricing, Policies & Facility Master Data) cho Quản lý Vận hành Doanh nghiệp. Tab 1 'Cấu hình Loại kho & Bảng giá': Bảng danh mục loại kho (Small, Medium, Large), diện tích, kích thước 3D, giá thuê cơ sở, bảng lịch sử điều chỉnh giá theo thời gian. Tab 2 'Chính sách Thuê & Cọc': Cấu hình tỷ lệ tiền cọc (mặc định 100% 1 tháng), thời hạn giữ chỗ Soft-lock (24 giờ), thời hạn thuê tối thiểu (1 tháng), các chu kỳ gia hạn (1, 3, 6, 12 tháng). Tab 3 'Chính sách Phạt & Khấu trừ': Phí phạt trễ hạn theo ngày, biểu phí dọn vệ sinh và bồi thường ổ khóa."

---

### [FR-020] Báo cáo tỷ lệ lấp đầy kho, doanh thu và nợ theo cơ sở và toàn hệ thống
- **Target Role:** Facility Manager, Business Operations Manager
- **Device Type:** `DESKTOP`
- **Stitch MCP Prompt:**
> "Thiết kế Dashboard Báo cáo Vận hành & Phân tích Doanh thu Đa cơ sở (Storage Operations & Financial Reports) cho Ban Giám đốc và Quản lý. Bộ lọc trên cùng: Chọn Cơ sở [Tất cả | Cơ sở Q7 | Cơ sở Bình Thạnh | Cơ sở Cầu Giấy], Chọn dải thời gian [Hôm nay | Tuần này | Tháng này | Tùy chọn], Nút 'Xuất báo cáo Excel/PDF'. Phần 1: 4 thẻ KPI lớn: [Tỷ lệ lấp đầy kho: 88.4% (Mục tiêu > 85%)] | [Tổng doanh thu tháng: 1.25 Tỷ VND] | [Số phòng đang Occupied / Tổng số phòng] | [Số ca nợ quá hạn: 4 ca]. Phần 2: Biểu đồ đường Doanh thu theo tháng; Biểu đồ hình tròn Tỷ lệ phân bổ trạng thái kho (Available, Occupied, Reserved, Locked). Phần 3: Bảng danh sách chi tiết các hợp đồng nợ quá hạn cần theo dõi."

---

### [FR-021] Quản lý người dùng, phân quyền RBAC và phân công phạm vi cơ sở
- **Target Role:** System Administrator
- **Device Type:** `DESKTOP`
- **Stitch MCP Prompt:**
> "Thiết kế màn hình Quản lý Người dùng, Vai trò & Phân công Phạm vi Cơ sở (User Management & Facility Scoping) cho Quản trị viên Hệ thống. Bảng danh sách tài khoản: Avatar, Họ tên, Email, SĐT, Vai trò [Customer | Staff | Facility Manager | Ops Manager | Admin], Trạng thái [Hoạt động | Bị khóa], Cơ sở được phân công (Hiển thị tên cơ sở hoặc 'Toàn hệ thống'). Cột thao tác: Sửa, Đổi vai trò, Phân công cơ sở, Khóa tài khoản. Modal 'Phân công Nhân sự vào Cơ sở': Cho phép chọn nhân viên và chọn 1 hoặc nhiều cơ sở kho phụ trách kèm thời hạn hiệu lực, thiết lập cơ chế cô lập dữ liệu (Facility Scoping)."

---

### [FR-022] Ghi nhận nhật ký kiểm toán bất biến (Audit Trail) cho thao tác đặc quyền
- **Target Role:** System Administrator
- **Device Type:** `DESKTOP`
- **Stitch MCP Prompt:**
> "Thiết kế màn hình Nhật ký Kiểm toán Hệ thống Bất biến (Immutable Audit Trail & Security Logs Explorer) cho System Admin. Thanh công cụ tìm kiếm và lọc nâng cao: Lọc theo Người thực hiện (User ID/Email), Lọc theo Hành động [ASSIGN_UNIT | APPROVE_REFUND | REVOKE_PIN | SEAL_UNIT | UPDATE_PRICE | LOGIN], Lọc theo Cơ sở, Lọc theo Dải ngày. Bảng nhật ký kiểm toán chi tiết: Cột Thời gian (Timestamp chính xác đến giây), Người thực hiện (User + Role), Địa chỉ IP, Hành động nghiệp vụ, Tài nguyên bị tác động, Dữ liệu trước khi đổi (Before State JSON tóm tắt), Dữ liệu sau khi đổi (After State JSON). Huy hiệu 'Append-Only / Verified' thể hiện tính toàn vẹn bất biến của nhật ký."
