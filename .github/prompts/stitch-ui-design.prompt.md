---
mode: agent
description: "Use when: the user wants to generate UI screens, design systems, wireframes, or interactive prototypes using Stitch MCP for any module, role, or feature in the project."
---

# Stitch UI Design & Prototyping Prompt

Dùng prompt này để yêu cầu AI Agent hoặc Development Agent thiết kế và sinh giao diện người dùng (UI screens / prototypes) bằng công cụ **Stitch MCP** cho hệ thống Boxora - Self-Storage Facility Rental and Management System (hoặc bất kỳ tính năng nào theo yêu cầu).

---

## 1. Mục tiêu (Objective)
Tự động hóa quy trình thiết kế UI/UX từ tài liệu yêu cầu (SRS, Blueprint, User Stories) thành các màn hình hoàn chỉnh, đạt chuẩn thẩm mỹ cao (Hiện đại, Trực quan, Bảng màu xanh navy/slate/cam chuẩn công nghiệp, Micro-interactions, Typography phân cấp rõ ràng, Responsive cho Desktop & Mobile) thông qua bộ công cụ **Stitch MCP**.

---

## 2. Quy trình thực hiện (Workflow)

### Bước 1: Tiếp nhận yêu cầu & Phân tích vai trò (Context & Role Intake)
- Xác định đối tượng người dùng / vai trò:
  - **Storage Customer (Khách hàng):** Giao diện Mobile/Desktop tập trung trải nghiệm liền mạch: tìm kho, đặt giữ chỗ, thanh toán, ký OTP, nhận mã PIN mở cửa, gia hạn và báo sự cố.
  - **Facility Staff (Nhân viên Cơ sở):** Tablet/Desktop hỗ trợ ca trực: tra cứu booking QR, đối soát 4 điều kiện check-in, checklist nghiệm thu bàn giao/trả kho kèm upload 2 ảnh, xử lý ticket.
  - **Facility Manager (Quản lý Cơ sở):** Desktop Web với sơ đồ mặt bằng kho tương tác, chỉ định phòng vật lý, duyệt niêm phong kho nợ, phân công ca trực, duyệt hoàn cọc và báo cáo cơ sở.
  - **Business Operations Manager (Quản lý Vận hành):** Desktop Web quản lý chuỗi cơ sở, danh mục loại kho, cấu hình lịch sử giá, chính sách cọc/hủy/phạt và báo cáo toàn hệ thống.
  - **System Administrator (Quản trị viên):** Desktop Web quản lý tài khoản, vai trò RBAC, phân công phạm vi cơ sở (Facility Scoping), lịch sử đăng nhập và nhật ký kiểm toán bất biến.
- Thu thập danh sách các thành phần cốt lõi: Header/Nav, Sidebar, Filter bar, Data table, Card grid, Action modal, Toast alert, Empty & Loading states.

### Bước 2: Khởi tạo Stitch Workspace & Design System
- Kiểm tra hoặc tạo mới Stitch Project:
  ```json
  // StitchMCP: create_project
  {}
  ```
- Khởi tạo hoặc áp dụng Design System chuẩn đồng nhất:
  - Sử dụng `create_design_system` hoặc `create_design_system_from_design_md` với token màu sắc (Primary: Navy `#1E3A8A`, Blue `#2563EB`, Accent: Orange `#EA580C`, Status: Green/Amber/Red/Slate), Typography (Inter, Plus Jakarta Sans), Border radius và Spacing scale.
  - Sử dụng `apply_design_system` để đồng bộ toàn bộ các màn hình trong cùng dự án.

### Bước 3: Sinh màn hình chi tiết từ Prompt (Generate Screen)
- Gọi công cụ Stitch MCP `generate_screen_from_text`:
  - `projectId`: ID dự án Stitch vừa tạo/truy xuất.
  - `deviceType`: `DESKTOP` (cho Portal Quản lý/Nhân viên/Admin) hoặc `MOBILE` (cho Portal Khách hàng / Checklist ca trực).
  - `modelId`: `GEMINI_3_8_FLASH`.
  - `prompt`: Cung cấp mô tả chi tiết màn hình theo cấu trúc chuẩn:
    - **Tên màn hình & Vai trò**
    - **Header & Navigation**
    - **Khu vực nội dung chính & Bố cục (Layout)**
    - **Bảng dữ liệu / Danh sách thẻ / Biểu đồ trực quan**
    - **Form nhập liệu / Modal xác nhận / Trạng thái tương tác (Hover, Active, Disabled)**
    - **Tone & Mood:** Hiện đại, sạch sẽ, công nghiệp tin cậy, viền tinh tế.

### Bước 4: Tinh chỉnh & Tạo biến thể (Refine & Variants)
- Dùng `get_screen` để kiểm tra kết quả thiết kế.
- Dùng `generate_variants` để tạo 2-3 phương án layout/style khác nhau cho cùng một màn hình để khách hàng/BA lựa chọn.
- Dùng `edit_screens` để tinh chỉnh chi tiết các component theo feedback.

### Bước 5: Bàn giao & Đồng bộ bằng chứng (Traceability & Delivery)
- Lưu ID màn hình (`screenId`), link xem trước và mã token thiết kế vào báo cáo:
  - File báo cáo bàn giao: `Development-Agent/templates/delivery-report.md` (mục Stitch Evidence).
  - Cập nhật tiến độ và comment bằng chứng lên GitHub Issue & GitHub Project #2.

---

## 3. Danh mục Prompt mẫu nhanh (Quick Prompt Templates)

### Template 1: Màn hình Tìm kho & Đặt giữ chỗ cho Customer (Mobile/Desktop)
> "Thiết kế màn hình Danh mục & Đặt giữ chỗ kho tự quản cho khách hàng Boxora. Thanh tìm kiếm và bộ lọc theo thành phố, diện tích (Small, Medium, Large) và khoảng giá. Danh sách các phòng kho hiển thị dạng Card trực quan với thông số kích thước 3D, giá thuê niêm yết theo tháng, huy hiệu số lượng phòng khả dụng, nút 'Đặt giữ chỗ ngay'. Kèm tóm tắt chi phí tiền cọc 100% 1 tháng và đồng hồ đếm ngược giữ chỗ Soft-lock 24 giờ."

### Template 2: Dashboard Vận hành & Doanh thu cho Facility Manager (Desktop Portal)
> "Thiết kế Dashboard điều hành Desktop Portal cho Facility Manager của cơ sở kho Boxora. Giao diện hiện đại, thanh bên Sidebar tinh gọn. Header có thông báo và avatar. Phần chính gồm: 4 thẻ KPI nổi bật (Tỷ lệ lấp đầy kho > 85%, Doanh thu tháng, Số phòng đang Occupied / Tổng số phòng, Số ca nợ quá hạn). Biểu đồ đường doanh thu 12 tháng, biểu đồ tròn phân bổ trạng thái kho (Available, Occupied, Reserved, Locked). Bảng danh sách 10 giao dịch gần nhất kèm trạng thái badge."

### Template 3: Màn hình Check-in & Nghiệm thu Bàn giao tại quầy (Tablet / Desktop Web)
> "Thiết kế màn hình Tablet/Desktop 'Nhân viên - Check-in & Nghiệm thu Bàn giao kho'. Gồm: Thanh tìm kiếm theo Mã đặt chỗ hoặc quét QR bằng camera. Thẻ hồ sơ khách hàng đối soát 4 điều kiện: đủ cọc, đủ tiền thuê tháng đầu, đã ký e-contract, đã xác minh CCCD gốc. Checklist kiểm tra 5 điểm hiện trạng phòng kho và khung tải tối thiểu 2 ảnh thực tế có timestamp. Nút bấm 'Hoàn tất bàn giao' chuyển kho sang Occupied và cấp mã PIN mở cửa an toàn."

---

## 4. Bảng tra cứu Tool Stitch MCP

| Tên Tool | Chức năng chính | Gợi ý tham số |
|---|---|---|
| `create_project` | Tạo dự án thiết kế mới | `{}` |
| `generate_screen_from_text` | Sinh giao diện từ văn bản mô tả | `projectId`, `prompt`, `deviceType`, `modelId` |
| `get_screen` | Lấy chi tiết màn hình đã sinh | `projectId`, `screenId` |
| `list_screens` | Liệt kê tất cả màn hình trong dự án | `projectId` |
| `generate_variants` | Tạo các biến thể khác nhau của màn hình | `projectId`, `screenId`, `prompt` |
| `edit_screens` | Sửa màn hình theo hướng dẫn | `projectId`, `screenId`, `editPrompt` |
| `create_design_system` | Tạo bộ Design System chuẩn hóa | `name`, `colorPalette`, `typography` |
| `apply_design_system` | Gắn Design System vào màn hình | `projectId`, `designSystemId` |
