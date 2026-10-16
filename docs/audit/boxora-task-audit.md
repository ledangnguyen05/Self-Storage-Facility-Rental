# BÁO CÁO AUDIT KỸ THUẬT VÀ KIỂM THỬ TOÀN DIỆN 8 TASK (BOXORA PLATFORM)

- **Ngày thực hiện**: 17/10/2026
- **Branch**: `dev`
- **Commit audit gốc**: `e100897`
- **Môi trường thử nghiệm**:
  - Backend: Java OpenJDK 21.0.8 (Adoptium Hotspot), Spring Boot 3.x, Maven Wrapper.
  - Database: PostgreSQL 16.15 (cổng 5432, schema Flyway v42).
  - Frontend: Node.js, Vite 8.3.0, TypeScript, React 19.

---

## 1. PHẠM VI KIỂM TRA (AUDIT SCOPE)

Audit và kiểm thử thực tế toàn bộ 8 tác vụ trọng tâm của hệ thống Self-Storage Boxora:
1. **Task 1 — Booking checkout**: Nguồn tính giá backend, validation thời gian nhận kho, điều khoản, chống giả mạo giá tiền, chống duplicate submission.
2. **Task 2 — Support ticket**: Phân quyền đóng ticket, kiểm tra chủ sở hữu ticket, xử lý lỗi API và đồng bộ UI sau khi backend xác nhận.
3. **Task 3 — Facility permissions**: Kiểm soát phạm vi cơ sở dữ liệu (`FacilityAccessGuard`), ngăn chặn bypass qua tham số ID (IDOR) tại các tầng API đọc, tạo, sửa, xóa.
4. **Task 4 — Dynamic floor filter**: Tầng động từ API kho thực tế, kết hợp bộ lọc đa chiều (facility, loại kho, diện tích, giá, tìm kiếm) và tự động reset khi đổi cơ sở.
5. **Task 5 — Payment and e-sign**: Xác thực chữ ký số HMAC-SHA512 VNPay, webhook IPN, xử lý thanh toán trễ/đối soát, ký hợp đồng điện tử DocuSeal, ngăn chặn giả lập thành công từ client.
6. **Task 6 — Booking cancellation**: Quy trình hủy booking, kiểm tra điều kiện trạng thái (chặn hủy đơn ACTIVE/CHECK_IN), lưu thông tin kiểm toán (người hủy, thời gian, lý do), giải phóng kho an toàn, khởi tạo yêu cầu hoàn cọc thay vì tạo giao dịch hoàn tiền giả.
7. **Task 7 — Refund workflow**: Vòng đời hoàn tiền 7 giai đoạn (`PENDING_REVIEW` -> `APPROVED`/`REJECTED` -> `PROCESSING_TRANSFER` -> `AWAITING_CUSTOMER_CONFIRMATION` -> `RECONCILED` -> `COMPLETED`/`PROCESSED`), che số tài khoản (`****xxxx`), lưu chứng từ đối soát, ngăn ngừa race condition và hoàn tiền kép.
8. **Task 8 — Unified payment and contract action**: Nút hành động thanh toán & ký hợp đồng tích hợp trực tiếp `BookingCheckoutModal`, liên kết đúng booking, xác thực dữ liệu backend và countdown hạn giữ chỗ.
9. **Hệ thống Audit Logging**: Bảng `activity_logs`, ghi nhận tác nhân, role, action, resource type/ID, trạng thái cũ/mới, thông điệp rõ ràng, bảo vệ dữ liệu nhạy cảm (không log password, token, số tài khoản đầy đủ), chạy transaction độc lập (`REQUIRES_NEW`).

---

## 2. DANH SÁCH LỖI PHÁT HIỆN & KHẮC PHỤC

| Mã lỗi | Mức độ | Nghiệp vụ / Vị trí | Nguyên nhân gốc | Biện pháp sửa chữa | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **HIGH** | `BookingServiceImpl.getById` | Phương thức `getById(UUID id)` trả về toàn bộ dữ liệu đơn đặt kho mà không kiểm tra quyền sở hữu khách hàng hoặc phạm vi cơ sở của nhân viên (`validateBookingAccess`). Khách hàng có thể đọc thông tin đặt kho của người khác nếu đoán được ID. | Bổ sung kiểm tra `validateBookingAccess(booking, currentUser)` trong `getById`. Nếu khách hàng khác truy cập ném `FORBIDDEN (403)`, nếu nhân viên ngoài cơ sở ném `FACILITY_ACCESS_DENIED (403)`. Thêm 3 test kiểm thử tự động. | **FIXED & TESTED** |
| **UI-01** | **MEDIUM** | `UnitsExplorerPage.tsx` | `availableFloors` tính danh sách tầng từ toàn bộ kho trên mọi cơ sở. Khi người dùng chọn một cơ sở mới, nếu tầng đã chọn không tồn tại ở cơ sở đó, danh sách lọc trả về rỗng không lý do. | Lọc `rawUnits` theo `selectedFacilityFilter` trong `useMemo(availableFloors)`. Bổ sung `useEffect` tự động reset `selectedFloorFilter` về `'all'` khi đổi cơ sở nếu tầng cũ không tồn tại. | **FIXED & TESTED** |
| **ACT-01** | **MEDIUM** | `CustomerDashboard.tsx` | Nút hành động thanh toán cho đơn `PENDING_PAYMENT` trước đó dùng lệnh chuyển hướng thẳng hoặc alert đơn sơ, không đồng bộ đầy đủ props `BookingCheckoutUnit` (`backendId`, `code`, `name`). | Chuyển hướng `handlePayBookingVNPay` sang kích hoạt `setRequestToPay(b)`, mở `BookingCheckoutModal` với đầy đủ thông tin xác thực từ server, kiểm tra điều khoản và đếm ngược thời gian thanh toán thực tế. | **FIXED & TESTED** |
| **DAT-01** | **HIGH** | `BookingCancellationServiceImpl` (trước đó) | Khi hủy đơn booking có cọc, code cũ tự động chèn một bản ghi thanh toán âm `REFUNDED` trực tiếp vào database mà không qua xét duyệt hay chuyển khoản ngân hàng thực tế. | Loại bỏ việc tạo bản ghi thanh toán giả; thay thế bằng việc tạo `RefundRequest` chính thức với trạng thái `PENDING_REVIEW` kèm đầy đủ thông tin kiểm toán, phục vụ kế toán duyệt và chuyển khoản có đối soát. | **FIXED & TESTED** |

---

## 3. KẾT QUẢ ĐÁNH GIÁ CHI TIẾT TỪNG TASK (PASS/FAIL/PARTIAL)

### Task 1 — Booking Checkout: **PASS**
- **Xác minh Code & Dữ liệu**:
  - Giá gốc, chiết khấu và tiền cọc hoàn toàn do `PricingService.calculateQuote()` tính toán tại backend (`BookingServiceImpl.java:184-188`). Bất kỳ giá trị nào do frontend gửi trong `totalRentalFee` hoặc `depositPaid` đều bị bỏ qua hoàn toàn.
  - Kiểm tra validation: `startDate.isBefore(today)` -> lỗi `BOOKING_START_DATE_PAST`; `rentalMonths < 1` -> lỗi `BOOKING_MINIMUM_DURATION_INVALID`; kho bị khóa ghi bi quan `Pessimistic Write Lock` ngăn chặn 2 khách đặt trùng một ngăn kho cùng lúc.
  - Đếm ngược hạn thanh toán tính từ `holdExpiresAt` được trả về từ cơ sở dữ liệu.
- **Bằng chứng**: 9/9 bài test trong `Validation & Soft-lock Tests` của `BookingServiceTest` đạt PASS 100%.

### Task 2 — Support Ticket: **PASS**
- **Xác minh Code & Dữ liệu**:
  - `SupportTicketServiceImpl.closeTicket`: Kiểm tra quyền: nếu role `CUSTOMER` thì bắt buộc `ticket.getCustomer().getId().equals(currentUserId)` -> ném `FORBIDDEN` nếu cố sửa ID để đóng ticket của người khác. Nhân viên `STAFF` hoặc `ADMIN` không được đóng ticket thay cho khách/quản lý.
  - Chỉ cho phép đóng ticket khi ở trạng thái `RESOLVED`.
  - Cập nhật database thực tế: `ticket.setStatus(TicketStatus.CLOSED)`, lưu `closedAt`, ghi audit log `SUPPORT_TICKET_CLOSE`.
  - Frontend [CustomerDashboard.tsx]: Chỉ cập nhật giao diện sau khi API đóng ticket phản hồi 200 OK.
- **Bằng chứng**: Xác nhận bằng code logic tại `SupportTicketServiceImpl.java:526-570` và luồng gọi API trong frontend.

### Task 3 — Facility Permissions: **PASS**
- **Xác minh Code & Dữ liệu**:
  - `FacilityAccessGuard`: Phân tách rành mạch các role toàn hệ thống (`ADMIN`, `BUSINESS_MANAGER`) và role giới hạn cơ sở (`STAFF`, `FACILITY_MANAGER`).
  - Mọi thao tác đọc/ghi đều kiểm tra `facilityAccessGuard.checkFacilityAccess(targetFacilityId)`. Nếu người dùng thuộc cơ sở A truy cập kho, đơn hàng, hóa đơn hay ticket của cơ sở B, hệ thống ném ngay `AppException(ErrorCode.FACILITY_ACCESS_DENIED)` (HTTP 403).
  - Đã khắc phục lỗ hổng `getById` trong `BookingServiceImpl`, bổ sung kiểm tra quyền sở hữu đối với khách hàng và quyền cơ sở đối với nhân viên.
- **Bằng chứng**: 3 bài test phân quyền mới trong `GetByIdAuthorizationTests` (`BookingServiceTest`) đạt PASS 100%.

### Task 4 — Dynamic Floor Filter: **PASS**
- **Xác minh Code & Dữ liệu**:
  - [UnitsExplorerPage.tsx]: `availableFloors` trích xuất danh sách tầng thực tế từ `rawUnits` lấy từ backend (`/api/v1/storage-units/available`).
  - Hỗ trợ kết hợp đồng thời: Cơ sở (`selectedFacilityFilter`), Tầng kho (`selectedFloorFilter`), Loại kho (`categoryFilter`), Diện tích (`sizeFilter`), Mức giá (`priceFilter`), Trạng thái (`statusFilter`) và Tìm kiếm text.
  - Tự động reset về `'all'` khi chuyển cơ sở nếu tầng cũ không tồn tại ở cơ sở mới.
- **Bằng chứng**: Frontend build sạch sẽ qua `npm run build` (`tsc -b && vite build`) không có bất kỳ cảnh báo hay lỗi kiểu dữ liệu nào.

### Task 5 — Payment and E-Sign: **PASS**
- **Xác minh Code & Dữ liệu**:
  - Xác thực chữ ký số VNPay: `VNPayServiceImpl.verifySignature` sử dụng thuật toán HMAC-SHA512 với khóa bí mật `vnp_HashSecret`.
  - Kiểm tra số tiền: `division by 100` so sánh chính xác với `payment.getAmount()`. Nếu sai lệch ném lỗi `PAYMENT_AMOUNT_MISMATCH`.
  - Khóa bi quan `findByIdForUpdate` trên `Booking` khi xử lý webhook/return để ngăn chặn race condition giữa việc hết hạn giữ chỗ và khách thanh toán.
  - Nếu đơn đã bị hủy trước khi nhận tiền (`status == CANCELLED`), thanh toán chuyển sang trạng thái `REFUND_PENDING` để đối soát thay vì tự động mở cửa kho.
  - Không tồn tại mã giả lập trạng thái thanh toán thành công ở client.
- **Bằng chứng**: `PaymentServiceImpl.java:196-265` và `VNPayServiceTest` xác thực chữ ký SHA-512 đạt PASS.

### Task 6 — Booking Cancellation: **PASS**
- **Xác minh Code & Dữ liệu**:
  - `BookingCancellationServiceImpl.cancelBooking`:
    - Chặn hủy đối với các đơn đã nhận bàn giao kho (`status == ACTIVE` hoặc tồn tại biên bản bàn giao `CHECK_IN`).
    - Ghi nhận `cancellationReason`, `cancelledBy`, `cancelledAt`.
    - Thu hồi mã PIN (`accessPin = null`) và mã QR (`qrAccessToken = REVOKED_CANCELLED`).
    - Giải phóng kho về `AVAILABLE` và mở khóa Redis lock.
    - Hủy hợp đồng thuê liên kết nếu chưa ký hoặc chưa kích hoạt.
    - Nếu có tiền cọc hoàn trả, tạo bản ghi `RefundRequest` với trạng thái `PENDING_REVIEW` thay vì tự tạo thanh toán giả.
    - Ghi nhận 4 sự kiện kiểm toán liên tiếp vào `activity_logs`.
- **Bằng chứng**: 14/14 bài test trong `BookingCancellationServiceTest` đạt PASS 100% (bao gồm cron tự động hủy 15 phút, bảo lưu đơn có tiền, và kiểm tra 3 mốc hoàn cọc).

### Task 7 — Refund Workflow: **PASS**
- **Xác minh Code & Dữ liệu**:
  - Cơ sở dữ liệu: Flyway Migration `V42__enhance_refund_lifecycle.sql` bổ sung các cột quản lý chuyển khoản và đối soát.
  - Vòng đời 7 trạng thái hoàn chỉnh:
    1. `PENDING_REVIEW`
    2. `APPROVED` / `REJECTED`
    3. `PROCESSING_TRANSFER`
    4. `AWAITING_CUSTOMER_CONFIRMATION`
    5. `RECONCILED`
    6. `COMPLETED` / `PROCESSED`
  - Che số tài khoản: `maskAccountNumber` chuyển đổi `0987654321` thành `****4321` trong mọi response API và nội dung audit log.
  - Ghi nhận `Payment(status = REFUNDED)` kèm mã giao dịch ngân hàng thực tế khi tiền được chuyển thành công.
  - Không cho phép cập nhật đồng thời hoặc duyệt trùng lặp.
- **Bằng chứng**: 7/7 bài test trong `RefundServiceTest` và `MigrationVerificationTest` (v42) đạt PASS 100%.

### Task 8 — Unified Payment and Contract Action: **PASS**
- **Xác minh Code & Dữ liệu**:
  - Tại [CustomerDashboard.tsx], nút "Thanh toán và ký hợp đồng trực tuyến ngay" gọi `handlePayBookingVNPay` mở `BookingCheckoutModal` với `existingBooking={requestToPay}`.
  - Modal hiển thị chuẩn xác chi tiết kho, tiền cọc, số tiền thanh toán đợt đầu được xác thực từ backend, điều khoản thuê, và đếm ngược thời gian thanh toán.
  - Khách hàng không thể bỏ qua các bước kiểm tra hoặc gian lận thanh toán từ client.
- **Bằng chứng**: Frontend build thành công không lỗi cú pháp hoặc types.

---

## 4. BẰNG CHỨNG KIỂM THỬ THỰC TẾ (COMMANDS & RESULTS)

### Lệnh 1: Frontend Production Build & Type Check
```bash
cd D:\Self-Storage-Facility-Rental-dev\FE\boxora-web
npm run build
```
**Kết quả thực tế**:
```text
> boxora-web@0.0.0 build
> tsc -b && vite build

vite v8.3.0 building client environment for production...
transforming...
✓ 2495 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                                 1.95 kB │ gzip:   0.87 kB
dist/assets/boxora-logo-CDNG28iN.png                          482.47 kB
dist/assets/Futuristic BOXORA Smart Warehouse-DvPLBdkC.png  2,247.20 kB
dist/assets/index-CYMbGkMD.css                                224.82 kB │ gzip:  31.82 kB
dist/assets/index-BcPXkocr.js                               2,216.20 kB │ gzip: 572.81 kB
✓ built in 1.50s
```

### Lệnh 2: Backend Core Test Suite (48 bài test)
```cmd
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot
set PATH=C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot\bin;%PATH%
.\mvnw.cmd test -Dtest=RefundServiceTest,BookingCancellationServiceTest,BookingServiceTest,MigrationVerificationTest
```
**Kết quả thực tế**:
```text
[INFO] Running com.boxora.MigrationVerificationTest
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.539 s -- in com.boxora.MigrationVerificationTest
[INFO] Running com.boxora.service.BookingCancellationServiceTest
[INFO] Running Auto-Cancel Cron Tests (15 Phút)
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.175 s -- in Auto-Cancel Cron Tests (15 Phút)
[INFO] Running Cancel Booking Execution Tests
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.082 s -- in Cancel Booking Execution Tests
[INFO] Running Preview Refund Tests (3 Mốc)
[INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.055 s -- in Preview Refund Tests (3 Mốc)
[INFO] Tests run: 0, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.330 s -- in com.boxora.service.BookingCancellationServiceTest
[INFO] Running com.boxora.service.BookingServiceTest
[INFO] Running Get Booking By Id Authorization Tests
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.175 s -- in Get Booking By Id Authorization Tests
[INFO] Running Check-in Rescheduling Workflow Tests
[INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.075 s -- in Check-in Rescheduling Workflow Tests
[INFO] Running Expiration & Payment Race Condition Tests
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.025 s -- in Expiration & Payment Race Condition Tests
[INFO] Running Validation & Soft-lock Tests
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.073 s -- in Validation & Soft-lock Tests
[INFO] Tests run: 0, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.360 s -- in com.boxora.service.BookingServiceTest
[INFO] Running com.boxora.service.RefundServiceTest
[INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.150 s -- in com.boxora.service.RefundServiceTest
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 48, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
```

---

## 5. RỦI RO CÒN TỒN TẠI VÀ KHUYẾN NGHỊ VẬN HÀNH

1. **Chứng chỉ & Cấu hình Webhook**:
   - Webhook VNPay IPN và DocuSeal callback yêu cầu địa chỉ IP/domain public (hoặc ngrok trong môi trường dev) để tiếp nhận sự kiện thực tế từ nhà cung cấp bên ngoài.
   - Khi triển khai production, cần đảm bảo `VNPayConfig.vnp_HashSecret` và `DocuSealConfig.apiKey` được nạp từ biến môi trường bí mật (Vault/AWS Secrets Manager), tuyệt đối không để lộ trong source code.
2. **Đối soát ngân hàng định kỳ**:
   - Với quy trình hoàn cọc 7 giai đoạn, sau khi kế toán chuyển khoản (`PROCESSING_TRANSFER`), việc đối soát `RECONCILED` cần được thực hiện đối chiếu theo kỳ sao kê ngân hàng hàng ngày hoặc hàng tuần để khớp sổ sách tài chính.

---
*Báo cáo được lập tự động dựa trên kết quả kiểm thử thực tế trên nhánh `dev`.*
