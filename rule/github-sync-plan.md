# Kế hoạch & Báo cáo Đồng bộ GitHub Project (GitHub Project Sync Plan)

**Project Code:** `funef21205` (Project ID: `2`)  
**Project Name:** `Boxora - Self-Storage Facility Rental and Management System`  
**Blueprint ID:** `BOXORA-SELF-STORAGE`  
**Blueprint Link:** [blueprint.md](file:///c:/Users/Phuc/Documents/WS_01_FU-main/WS_01_FU-main/blueprint.md)  
**Tài liệu gốc SRS:** [srs.txt](file:///c:/Users/Phuc/Documents/WS_01_FU-main/WS_01_FU-main/srs.txt)  
**Trạng thái kế hoạch:** `SẴN SÀNG ĐỒNG BỘ (Ready for Sync)`  
**Ngày cập nhật:** 2026-10-07  
**GitHub Project URL:** [https://github.com/users/funef21205/projects/2](https://github.com/users/funef21205/projects/2)  
**Target BE Repository:** [https://github.com/funef21205/BOXORA-BE](https://github.com/funef21205/BOXORA-BE)  
**Target FE Repository:** [https://github.com/funef21205/BOXORA-FE](https://github.com/funef21205/BOXORA-FE)  

---

## 1. Danh mục 22 Yêu cầu Chức năng Chuẩn hóa (FR-001 đến FR-022)

Toàn bộ 22 Functional Requirements theo Software Requirements Specification (SRS) của Boxora được phân bổ thành các Issue và nhiệm vụ đồng bộ lên **GitHub Project #2 (Boxora - Self-Storage Facility Rental and Management System)**:

| Blueprint ID | Tiêu đề Issue / Feature | Target Repo | Priority | Status | Size | Target Date | Branch chuẩn | Area Label |
|---|---|---|---|---|---|---|---|---|
| `FR-001` | [FR-001] Hiển thị danh mục cơ sở, loại kho, giá và số phòng trống | Full-stack | P0 | Ready | M | 2026-10-15 | `feat/1-facility-catalog` | `area-catalog` |
| `FR-002` | [FR-002] Khách hàng chọn cơ sở, loại kho, ngày thuê và tạo đơn đặt giữ chỗ | Full-stack | P0 | Ready | M | 2026-10-18 | `feat/2-reservation-creation` | `area-reservation` |
| `FR-003` | [FR-003] Tích hợp thanh toán tiền cọc, tiền thuê và Webhook đối soát ký số | Full-stack | P0 | Ready | L | 2026-10-22 | `feat/3-payment-webhook` | `area-payment` |
| `FR-004` | [FR-004] Cơ chế giữ chỗ tạm thời (Soft-lock) 24 giờ và tự động giải phóng tồn kho | Backend | P0 | Ready | M | 2026-10-25 | `feat/4-softlock-24h` | `area-reservation` |
| `FR-005` | [FR-005] Khách hàng đặt lịch hẹn check-in và sinh mã tra cứu / QR Code | Full-stack | P1 | Ready | S | 2026-10-28 | `feat/5-checkin-appointment` | `area-checkin` |
| `FR-006` | [FR-006] Nhân viên tra cứu đơn đặt chỗ bằng mã QR hoặc số điện thoại | Full-stack | P0 | Ready | S | 2026-10-30 | `feat/6-qr-booking-lookup` | `area-checkin` |
| `FR-007` | [FR-007] Nhân viên/Quản lý cơ sở chỉ định phòng kho vật lý cụ thể cho đơn booking | Full-stack | P0 | Ready | M | 2026-11-02 | `feat/7-unit-assignment` | `area-facility` |
| `FR-008` | [FR-008] Đối soát 4 điều kiện, checklist nghiệm thu, cấp mã PIN AES-256 và Occupied | Full-stack | P0 | Ready | L | 2026-11-06 | `feat/8-handover-pin` | `area-handover` |
| `FR-009` | [FR-009] Màn hình "Kho của tôi" xem hợp đồng, mã PIN mở cửa và lịch sử hóa đơn | Frontend | P0 | Ready | M | 2026-11-09 | `feat/9-my-units-portal` | `area-active-units` |
| `FR-010` | [FR-010] Khách hàng tạo phiếu yêu cầu hỗ trợ sự cố gắn với phòng kho đang thuê | Full-stack | P0 | Ready | M | 2026-11-12 | `feat/10-support-ticket-create` | `area-support` |
| `FR-011` | [FR-011] Bảng công việc hàng ngày tổng hợp lịch nhận/trả kho và ticket cho nhân viên | Frontend | P0 | Ready | M | 2026-11-15 | `feat/11-staff-daily-tasks` | `area-handover` |
| `FR-012` | [FR-012] Nhân viên cơ sở tiếp nhận, cập nhật tiến độ xử lý và đóng phiếu hỗ trợ | Full-stack | P0 | Ready | S | 2026-11-18 | `feat/12-support-ticket-resolve` | `area-support` |
| `FR-013` | [FR-013] Tự động gửi thông báo nhắc gia hạn hợp đồng trước 7 ngày và 3 ngày | Backend | P0 | Ready | S | 2026-11-20 | `feat/13-renewal-reminder-job` | `area-renewal` |
| `FR-014` | [FR-014] Khách hàng gia hạn hợp đồng trực tuyến và thanh toán trước hạn >= 3 ngày | Full-stack | P0 | Ready | M | 2026-11-23 | `feat/14-online-contract-renewal` | `area-renewal` |
| `FR-015` | [FR-015] Kiểm tra hiện trạng trả kho, tải tối thiểu 2 ảnh và tính phí hư hại/vệ sinh | Full-stack | P0 | Ready | M | 2026-11-26 | `feat/15-checkout-inspection` | `area-checkout` |
| `FR-016` | [FR-016] Tự động tính cọc thực hoàn và luồng duyệt hoàn tiền theo SLA 3–5 ngày | Full-stack | P0 | Ready | M | 2026-11-29 | `feat/16-deposit-refund-sla` | `area-checkout` |
| `FR-017` | [FR-017] Tác vụ quét nợ hàng ngày lúc 00:00, tính phạt trễ hạn và khóa PIN ngày N+3 | Backend | P0 | Ready | M | 2026-12-02 | `feat/17-overdue-scan-lock` | `area-overdue` |
| `FR-018` | [FR-018] Quản lý cơ sở duyệt niêm phong kho vật lý ngày N+7 và pháp lý ngày N+30 | Full-stack | P0 | Ready | M | 2026-12-05 | `feat/18-unit-sealing-workflow` | `area-overdue` |
| `FR-019` | [FR-019] Business Operations Manager cấu hình cơ sở, loại kho, giá và chính sách | Full-stack | P0 | Ready | L | 2026-12-08 | `feat/19-pricing-policy-admin` | `area-policy` |
| `FR-020` | [FR-020] Báo cáo tỷ lệ lấp đầy kho, doanh thu và nợ theo cơ sở và toàn hệ thống | Full-stack | P0 | Ready | L | 2026-12-12 | `feat/20-reporting-dashboards` | `area-reports` |
| `FR-021` | [FR-021] Quản lý người dùng, phân quyền RBAC và phân công phạm vi cơ sở | Full-stack | P0 | Ready | L | 2026-12-16 | `feat/21-user-rbac-facility-scope`| `area-auth` |
| `FR-022` | [FR-022] Ghi nhận nhật ký kiểm toán bất biến (Audit Trail) cho thao tác đặc quyền | Backend | P0 | Ready | M | 2026-12-20 | `feat/22-audit-trail-logging` | `area-audit` |

---

## 2. Hệ thống Nhãn (Labels) Chuẩn hóa cho GitHub

Khi tiến hành tạo Issue và gán vào Project:
- **Độ ưu tiên (Priority):**
  - `P0-Critical` (Must-have cho MVP)
  - `P1-High` (Should-have)
  - `P2-Medium` (Could-have)
- **Loại hình (Type):**
  - `feature`
  - `task`
  - `bug`
- **Khu vực nghiệp vụ (Area):**
  - `area-auth`: Xác thực, phân quyền RBAC, quản lý tài khoản và phân công cơ sở.
  - `area-catalog`: Khám phá cơ sở, kích thước kho, hình ảnh và tình trạng phòng trống.
  - `area-reservation`: Đặt giữ chỗ và cơ chế giữ kho tạm thời (Soft-lock 24h).
  - `area-payment`: Tích hợp thanh toán trực tuyến, hoàn tiền và đối soát Webhook.
  - `area-contract`: Hợp đồng điện tử và ký xác thực qua mã OTP email.
  - `area-checkin`: Đặt lịch hẹn nhận kho và tra cứu mã đặt chỗ / QR check-in.
  - `area-handover`: Nghiệm thu bàn giao kho, checklist hiện trạng và mã hóa cấp mã PIN.
  - `area-active-units`: Quản lý kho đang thuê của khách hàng trên giao diện cá nhân.
  - `area-renewal`: Gia hạn hợp đồng trực tuyến và tác vụ gửi thông báo nhắc hạn.
  - `area-overdue`: Quét nợ tự động, phạt chậm hạn, khóa PIN và duyệt niêm phong kho.
  - `area-checkout`: Nghiệm thu trả kho, tính phí phát sinh và đối soát hoàn trả cọc.
  - `area-support`: Quản lý phiếu yêu cầu hỗ trợ sự cố đa cơ sở.
  - `area-policy`: Cấu hình danh mục cơ sở, loại kho, bảng giá và chính sách vận hành.
  - `area-reports`: Báo cáo tỷ lệ lấp đầy kho, doanh thu và đối soát tài chính.
  - `area-audit`: Nhật ký kiểm toán an ninh bất biến và lịch sử đăng nhập.

---

## 3. Quy chuẩn Vận hành và Bàn giao theo Vòng đời (Delivery Lifecycle)

Mỗi tính năng khi bắt đầu triển khai thực hiện theo các bước nghiêm ngặt:

1. **Kiểm tra thông tin trước khi code:**
   - Đối chiếu `Blueprint ID` (ví dụ `FR-001`), `Target Repository`, tiêu chí chấp nhận (Gherkin AC).
   - Kiểm tra remote URL bằng `git remote -v`.
2. **Tạo nhánh chuẩn:**
   - Cú pháp: `<type>/<issue-number>-<short-slug>`
   - Ví dụ: `feat/1-facility-catalog` hoặc `feat/8-handover-pin`.
3. **Cập nhật tiến độ trên GitHub Project:**
   - Chuyển trạng thái item sang `In Progress`.
4. **Mở Pull Request chuẩn:**
   - Luôn gắn từ khóa liên kết: `Closes #<issue-number>` (ví dụ `Closes #1`).
   - Ghi rõ bằng chứng kiểm thử (Unit test, Integration test, Playwright screenshot/trace).
5. **Định dạng Comment tiến độ:**
   ```text
   Progress: In Progress
   Summary: Hoàn tất thiết kế API endpoint và viết 6/6 test cases cho tính năng Soft-lock 24 giờ
   Evidence: Test report pass 100%, commit hash 7a8b9c
   Branch/PR: feat/4-softlock-24h
   Next: Tích hợp đồng hồ đếm ngược 24h trên giao diện đặt kho
   Blocker: None
   ```
6. **Định nghĩa Hoàn tất (Definition of Done):**
   - Chỉ chuyển trạng thái sang `Done` khi PR đã được merge vào `main`, 100% Gherkin AC đạt, Swagger/OpenAPI được cập nhật đầy đủ và có đầy đủ bằng chứng kiểm thử.
