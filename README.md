# 📦 BOXORA - Smart Self-Storage Facility Management System

Hệ thống quản lý và cho thuê kho tự quản thông minh (**Self-Storage Management Platform**), cung cấp giải pháp chuyển đổi số toàn diện từ quy trình tìm kiếm, đặt kho trực tuyến, hợp đồng điện tử, thanh toán VNPAY, bàn giao QR Check-in/Check-out đến phân hệ quản trị vận hành dành cho nhân viên và ban giám đốc.

---

## 🌟 Tính Năng Nổi Bật

### 🏢 Dành Cho Khách Hàng (Customer Portal)
- **Tìm kiếm & Khám phá kho:** Bản đồ cơ sở trực quan (Leaflet/OpenStreetMap), bộ lọc theo kích thước (Mini, Small, Medium, Large), nhiệt độ (thường / máy lạnh), tính năng thông minh.
- **Tính toán diện tích gợi ý (Storage Calculator):** Ước tính kích cỡ kho phù hợp dựa trên số lượng đồ đạc, kiện hàng.
- **Hợp đồng điện tử (E-Contract):** Ký số hợp đồng trực tuyến tích hợp **DocuSeal**.
- **Thanh toán trực tuyến:** Tích hợp cổng thanh toán **VNPAY** an toàn, bảo mật.
- **Quản lý kho cá nhân:** Xem danh sách hợp đồng, mã PIN mở cửa, tạo mã QR check-in nhận phòng, yêu cầu gia hạn / trả kho.
- **Hỗ trợ & Khiếu nại (Support Ticket):** Gửi phản hồi, theo dõi tiến độ xử lý sự cố.

### 💼 Phân Hệ Vận Hành & Quản Trị (Staff & Management Portal)
- **Front Desk / Nhân viên vận hành:** 
  - Quét mã QR tiếp nhận khách check-in bàn giao kho.
  - Biên bản bàn giao, kiểm tra tình trạng kho (Check-in / Check-out Inspection checklist).
  - Ghi nhận chỉ số điện/nước, biên nhận tài sản, chụp ảnh đối chứng (evidence photos).
- **Thu ngân / Kế toán (Cashier & Ledger):** Quản lý công nợ, hóa đơn, hoàn tiền cọc, sổ quỹ tiền mặt / chuyển khoản.
- **Hỗ trợ khách hàng (Ticket Management):** Phân công xử lý khiếu nại, sự cố, liên hệ BOM.
- **Giám đốc điều hành & Quản lý cơ sở (Director / Facility Manager):** Báo cáo doanh thu, tỷ lệ lấp đầy (occupancy rate), phân tích hiệu suất mặt bằng và quản trị nhân sự.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

### Backend
- **Core Framework:** Spring Boot 3.5.x (Java 17 / 21)
- **Security:** Spring Security, JWT (JSON Web Token), OAuth2 Google Sign-in
- **Database:** PostgreSQL 16
- **Cache & Queue:** Redis 7
- **Database Migration:** Flyway
- **Mailing:** JavaMail Sender & Mailpit (Local development catcher)
- **Tích hợp bên ngoài:** VNPAY Sandbox, DocuSeal E-Signature API, Cloudinary / File Storage

### Frontend
- **Framework:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS v4, Lucide React (Icons), Motion (Animations)
- **Bản đồ & QR:** Leaflet, React Leaflet, html5-qrcode, qrcode
- **HTTP Client:** Axios (cấu hình interceptor, auto refresh token)
- **Code Quality:** Oxlint, TypeScript Compiler Check

### DevOps & Tools
- **Containerization:** Docker & Docker Compose
- **Quality Gate:** SonarQube Scanner
- **Automation Scripts:** Batch script khởi động 1-click (`start_local.bat`, `start_demo_online.bat`)

---

## 📁 Cấu Trúc Dự Án

```text
Self-Storage-Facility-Rental/
├── BE/
│   └── boxora/                 # Mã nguồn Backend Spring Boot
│       ├── src/                # Controller, Service, Repository, Entity, DTO, Config
│       ├── .env.example        # Mẫu biến môi trường cho Backend
│       └── pom.xml             # Quản lý dependencies Maven
├── FE/
│   └── boxora-web/             # Mã nguồn Frontend React + Vite
│       ├── src/                # Components, Pages, Hooks, Services, Contexts
│       ├── .env.example        # Mẫu biến môi trường cho Frontend
│       └── package.json        # Dependencies & scripts Frontend
├── docs/                       # Tài liệu thiết kế hệ thống, audit, báo cáo
├── docker-compose.yml          # Container PostgreSQL, Redis, Mailpit cho Local Dev
├── docker-compose.sonar.yml    # Container SonarQube phân tích chất lượng code
├── start_local.bat             # Script chạy toàn bộ hệ thống Local chỉ với 1 click
└── start_demo_online.bat       # Script khởi động FE kết nối Backend Online
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy (Quick Start)

### Yêu Cầu Môi Trường
- **JDK:** 17 hoặc 21
- **Node.js:** v18 trở lên (khuyên dùng v20/v22) & npm
- **Database & Cache:** PostgreSQL 16, Redis (hoặc dùng Docker Compose đi kèm)
- **Git**

---

### Cách 1: Khởi Chạy Tự Động Với 1 Click (Khuyên dùng trên Windows)

Chỉ cần chạy file script có sẵn ở thư mục gốc:

```cmd
start_local.bat
```

Script sẽ tự động:
1. Kiểm tra và khởi động PostgreSQL service / Docker.
2. Kiểm tra môi trường JDK và biên dịch/khởi động Spring Boot Backend (`http://localhost:8080`).
3. Cài đặt `npm install` (nếu cần) và khởi động Vite Dev Server (`http://localhost:5173`).
4. Tự động mở trình duyệt web.

---

### Cách 2: Khởi Chạy Thủ Công Từng Phân Hệ

#### 1. Khởi động dịch vụ hỗ trợ (PostgreSQL, Redis, Mailpit)
Sử dụng Docker Compose:
```bash
docker compose up -d
```
- PostgreSQL: `localhost:5432` (db: `boxora_db`, user: `postgres`, pass: `postgres`)
- Redis: `localhost:6379`
- Mailpit UI (xem email xác thực / OTP): `http://localhost:8025`

#### 2. Cấu hình & Khởi chạy Backend
Vào thư mục Backend:
```bash
cd BE/boxora
```
Sao chép cấu hình môi trường:
- Windows (CMD/PowerShell): `copy .env.example .env`
- Linux/macOS: `cp .env.example .env`

Cập nhật các biến môi trường trong `.env` nếu có thay đổi (database password, JWT secret, VNPAY sandbox credentials).

Khởi chạy Spring Boot:
- Dùng Maven Wrapper:
  ```bash
  # Windows:
  mvnw.cmd spring-boot:run
  # Linux/macOS:
  ./mvnw spring-boot:run
  ```
Backend sẽ sẵn sàng tại `http://localhost:8080`.

#### 3. Cấu hình & Khởi chạy Frontend
Mở một terminal mới, chuyển vào thư mục Frontend:
```bash
cd FE/boxora-web
```
Sao chép file cấu hình môi trường:
- Windows (CMD/PowerShell): `copy .env.example .env`
- Linux/macOS: `cp .env.example .env`

Cài đặt dependencies và chạy server:
```bash
npm install
npm run dev
```
Mở trình duyệt truy cập: `http://localhost:5173`.

---

## 🔐 Tài Khoản Trải Nghiệm Mẫu (Demo Credentials)

Sau khi khởi động cơ sở dữ liệu và seed dữ liệu mặc định:

| Vai trò (Role) | Email đăng nhập | Mật khẩu mặc định | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| **Director** | `director@boxora.com` | `Password@123` | Quản trị cấp cao, xem báo cáo doanh thu & KPI toàn hệ thống |
| **Facility Manager** | `manager@boxora.com` | `Password@123` | Quản lý kho bãi, cơ sở vật chất, phân công nhân sự |
| **Front Desk Staff** | `staff@boxora.com` | `Password@123` | Quét QR bàn giao kho, check-in, check-out, lập biên bản |
| **Cashier / Accountant** | `cashier@boxora.com` | `Password@123` | Thu ngân, quản lý công nợ, xuất hóa đơn & hoàn cọc |
| **Customer** | `customer@boxora.com` | `Password@123` | Đặt thuê kho, thanh toán thử nghiệm, tạo ticket hỗ trợ |

---

## 🔍 Kiểm Tra Chất Lượng Code (Code Quality & SonarQube)

Để kiểm tra code với SonarQube:
1. Chạy SonarQube server:
   ```bash
   docker compose -f docker-compose.sonar.yml up -d
   ```
2. Truy cập `http://localhost:9000` (user/pass mặc định: `admin` / `admin`).
3. Chạy lệnh phân tích cho Backend:
   ```bash
   cd BE/boxora
   mvn clean verify sonar:sonar -Dsonar.token=<YOUR_SONAR_TOKEN>
   ```
4. Chạy kiểm tra lint cho Frontend:
   ```bash
   cd FE/boxora-web
   npm run lint
   ```

---

## 🤝 Đóng Góp & Quy Chuẩn Phát Triển (Contribution & Git Flow)
- Nhánh **`main`**: Nhánh phát hành chính thức, sẵn sàng triển khai demo / production.
- Nhánh **`dev`**: Nhánh tích hợp tính năng hàng ngày của cả team.
- Quy ước đặt tên nhánh tính năng: `feature/<tên-tính-năng>`, `fix/<tên-lỗi>`, `refactor/<tên-module>`.
- Trước khi push code: Đảm bảo build thành công và không phát sinh lỗi compile/lint (`npm run build` đối với FE, `mvn test-compile` đối với BE).

---

## 📄 Bản Quyền
Dự án được xây dựng và phát triển phục vụ đề tài Hệ Thống Quản Lý Cho Thuê Kho Tự Quản Thông Minh **BOXORA**. Mọi quyền được bảo lưu.
