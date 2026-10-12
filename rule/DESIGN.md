---
name: Boxora Smart Storage
description: Precision Self-Storage Facility Rental and Management Design System
colors:
  primary: "#0891b2"
  primary-hover: "#0e7490"
  primary-container: "#ecfeff"
  on-primary-container: "#0e7490"
  secondary: "#0f172a"
  secondary-container: "#f1f5f9"
  accent-cyan: "#06b6d4"
  accent-orange: "#ea580c"
  neutral-bg: "#f8fafc"
  neutral-surface: "#ffffff"
  neutral-subtle: "#f1f5f9"
  border: "#e2e8f0"
  border-strong: "#cbd5e1"
  text-primary: "#0f172a"
  text-secondary: "#475569"
  status-success: "#166534"
  status-warning: "#b45309"
  status-error: "#ba1a1a"
typography:
  headline:
    fontFamily: "Plus Jakarta Sans, Inter, sans-serif"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontWeight: 600
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
---

# Design System: Boxora Smart Storage

## Overview

**Creative North Star: "The Precision Vault" (Hầm bảo chứng chuẩn xác)**

Hệ thống thiết kế của Boxora kết hợp cảm giác kiên cố, chuẩn mực của một cơ sở kho lưu trữ an ninh cao với trải nghiệm kỹ thuật số hiện đại, trực quan và tiện lợi. Giao diện thể hiện sự tin cậy tuyệt đối thông qua bảng màu xanh biển sâu (Deep Teal & Slate Navy), nền trung tính sáng mát (Slate-50), cấu trúc lưới trật tự và các linh kiện mang phản hồi xúc giác tinh tế (Tactile & Confident).

Mỗi khối thông tin, sơ đồ mặt bằng hay thẻ dữ liệu phòng kho đều được sắp xếp rõ ràng, có phân cấp thị giác mạch lạc, loại bỏ hoàn toàn các trang trí dư thừa hoặc hiệu ứng bóng đổ lòe loẹt.

**Key Characteristics:**
- **Kiên cố & Minh bạch:** Thẻ nội dung viền sắc nét, màu sắc biểu thị trạng thái rõ ràng (Xanh Teal: an toàn/hoạt động, Cam/Đỏ: cảnh báo/quá hạn).
- **Tương tác có phản hồi vật lý (Tactile):** Nút bấm và thẻ có độ nảy cơ học vi mô khi hover và click.
- **Kỹ thuật số hóa dữ liệu (Data Tabular & Monospace):** Mã phòng kho, mã PIN, số tiền và thời hạn luôn sử dụng phông chữ monospace/tabular số học chuẩn xác.

## Colors

Bảng màu mang tính chất an toàn công nghiệp cao cấp, sử dụng sắc Deep Teal làm điểm nhấn uy tín kết hợp với Slate Navy vững chãi trên nền xám sáng thanh lịch.

### Primary
- **Deep Precision Teal** (`#0891b2`): Màu thương hiệu chính, đại diện cho độ tin cậy, giải pháp thông minh và các hành động quan trọng (CTA, trạng thái khả dụng, xác nhận thanh toán).
- **Teal Hover / Deep Focus** (`#0e7490`): Trạng thái di chuột và tương tác sâu của các thành phần chính.
- **Teal Container Subtle** (`#ecfeff`): Nền khối nổi bật nhẹ dành cho mã xác thực PIN, thông báo bảo mật.

### Secondary
- **Slate Navy** (`#0f172a`): Đại diện cho sự kiên cố của kho vật lý, văn bản tiêu đề chính và các nút hành động bổ trợ mang tính quản trị.
- **Vibrant Cyan** (`#06b6d4`): Màu nhấn phụ cho các chỉ số công nghệ, viền sáng tinh tế.
- **Safety Orange** (`#ea580c`): Dùng cho cảnh báo bảo trì, sắp đến hạn hoặc các mốc cần chú ý của hợp đồng.

### Neutral
- **Canvas Background** (`#f8fafc`): Màu nền tổng thể trang, mát mắt, giảm mỏi mắt cho người dùng.
- **Card Surface** (`#ffffff`): Mặt phẳng thẻ nội dung, danh sách kho và bảng biểu.
- **Subtle Surface** (`#f1f5f9`): Nền phân vùng dữ liệu phụ, header bảng biểu.
- **Border Default** (`#e2e8f0`): Đường viền chia ngăn mạch lạc.
- **Border Strong** (`#cbd5e1`): Đường viền nhấn mạnh cho ô nhập liệu active hoặc thẻ được chọn.
- **Text Primary** (`#0f172a`): Văn bản chính có độ tương phản cao, dễ đọc.
- **Text Variant** (`#475569`): Nhãn phụ, mô tả phụ và chú thích.

### Named Rules
**The Vault Contrast Rule:** Không bao giờ sử dụng màu chữ xám mờ trên nền có màu. Tất cả thông số mã số, tiền tệ và hạn dùng phải đạt tỷ lệ tương phản tối thiểu 4.5:1 (WCAG AA).

## Typography

**Display Font:** Plus Jakarta Sans (fallback: Inter, sans-serif)  
**Body Font:** Inter (fallback: system-ui, sans-serif)  
**Label/Mono Font:** JetBrains Mono (fallback: monospace)

**Character:** Sự kết hợp giữa nét hình học vững chắc của Plus Jakarta Sans cho tiêu đề lớn, tính trung tính dễ đọc tối đa của Inter cho nội dung và tính kỹ thuật số chuẩn xác của JetBrains Mono cho các mã căn kho, số PIN và giá tiền.

### Hierarchy
- **Display** (Bold 700, `2.25rem` – `3rem`, `1.1`): Hero banner, tiêu đề trang chủ, số liệu tổng quan trọng điểm.
- **Headline** (SemiBold 600, `1.5rem` – `1.875rem`, `1.25`): Tên cơ sở kho, tiêu đề phân hệ, tiêu đề hợp đồng.
- **Title** (SemiBold 600, `1.125rem` – `1.25rem`, `1.3`): Tên loại phòng kho, tiêu đề modal, tên thẻ dịch vụ.
- **Body** (Regular 400 / Medium 500, `0.875rem` – `1rem`, `1.5`): Đoạn văn bản nội dung, hướng dẫn quy trình, điều khoản.
- **Label / Code** (Medium 500 / SemiBold 600, `0.75rem` – `0.875rem`, tracking +0.03em): Mã kho (BOX-A102), mã PIN (6 số), trạng thái badge.

### Named Rules
**The Tabular Currency Rule:** Mọi giá trị tiền tệ (VND) và ngày giờ check-in phải sử dụng font-variant-numeric: tabular-nums để căn lề thẳng hàng tuyệt đối trong mọi bảng biểu.

## Layout

Hệ thống lưới dựa trên hệ số 8px (4, 8, 16, 24, 32, 48px). Khung chứa (Container) tối đa 1280px căn giữa với khoảng đệm responsive:
- Mobile (< 768px): Padding bên 16px, thẻ xếp một cột thẳng đứng.
- Tablet (768px – 1024px): Padding bên 24px, lưới 2 cột cho danh sách kho.
- Desktop (> 1024px): Padding bên 32px, bố cục sidebar cố định cho nhân viên/quản lý hoặc lưới 3-4 cột cho kho khách hàng.

## Elevation & Depth

Giao diện áp dụng phong cách **Layered Tonal Depth** (độ sâu theo tông nền kết hợp viền sắc nét) thay vì đổ bóng đậm. Bóng đổ chỉ xuất hiện như một phản hồi xúc giác khi tương tác.

### Shadow Vocabulary
- **Resting Card:** `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)`
- **Interactive Hover:** `box-shadow: 0 8px 16px -4px rgba(15, 23, 42, 0.06), 0 2px 6px -2px rgba(15, 23, 42, 0.04)`
- **Modal / Floating Drawer:** `box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 10px 10px -5px rgba(15, 23, 42, 0.04)`

### Named Rules
**The Elevation on Action Rule:** Ở trạng thái nghỉ, thẻ thông tin nằm phẳng trên nền với viền `1px solid #e2e8f0`. Chỉ khi người dùng di chuột hoặc chọn, thẻ mới nâng độ cao lên 2px cùng bóng mờ tương ứng.

## Shapes

- **Bán kính bo góc (Corner Radius):**
  - Nút bấm & Ô nhập liệu: `8px` (`rounded-md`) tạo cảm giác tin cậy, chuẩn mực.
  - Thẻ thông tin (Cards): `16px` (`rounded-2xl`) tạo cảm giác hiện đại, dễ tiếp cận.
  - Badge trạng thái: `9999px` (`rounded-full`) hình viên thuốc gọn gàng.
  - Hộp modal & Popover: `16px` (`rounded-2xl`).
- **Đường viền:** Đồng nhất độ dày 1px cho viền ngăn cách; không dùng viền dày trên 2px ngoại trừ trạng thái focus outline.

## Components

### Buttons
- **Shape:** Bo góc 8px (`0.5rem`).
- **Primary:** Nền `#0891b2`, chữ `#ffffff`, padding `8px 16px`, font-weight 600.
- **Hover / Active:** Hover nâng nhẹ `translateY(-1px)`, đổi nền `#0e7490`, active nhấn xuống `scale(0.98)`.
- **Secondary:** Nền `#0f172a`, chữ `#ffffff`, hover đổi nền `#1e293b`.
- **Ghost / Outlined:** Nền trong suốt, viền `1px solid #e2e8f0`, chữ `#0f172a`, hover nền `#f1f5f9`.

### Cards / Containers
- **Corner Style:** Bo góc 16px (`1rem`).
- **Background:** `#ffffff` trên nền canvas `#f8fafc`.
- **Border:** `1px solid #e2e8f0`, hover chuyển sang `#cbd5e1`.
- **Padding:** 16px (mobile) đến 24px (desktop).

### Badges & Chips
- **Secure / Active:** Nền `#ecfeff`, viền `#a5f3fc`, chữ `#0891b2`.
- **Available:** Nền `#f0fdf4`, viền `#bbf7d0`, chữ `#166534`.
- **Warning / Due:** Nền `#fffbeb`, viền `#fde68a`, chữ `#b45309`.
- **Danger / Overdue:** Nền `#fef2f2`, viền `#fecaca`, chữ `#b91c1c`.
- **Font:** JetBrains Mono, cỡ chữ 11px, in hoa nhẹ nhàng.

### Inputs / Fields
- **Style:** Nền trắng `#ffffff`, viền `1px solid #e2e8f0`, bo góc 8px, padding `10px 14px`.
- **Focus:** Viền chuyển sang `#0891b2`, outline vòng sáng `ring-2 ring-[#0891b2]/20`.
- **Error:** Viền `#ba1a1a`, thông báo lỗi màu đỏ kèm biểu tượng cảnh báo.

### Signature Component: The PIN / Smart Unit Lock Box
Khối hiển thị mã PIN mở kho độc quyền: Nền tối `#0f172a`, số PIN hiển thị font JetBrains Mono cỡ lớn, phân tách rõ ràng từng ký tự, có nút sao chép và chỉ báo trạng thái thời gian thực (Active / Expired).

## Do's and Don'ts

### Do:
- **Do** sử dụng đúng mã hex và token đã quy định trong `:root`.
- **Do** gán font-family JetBrains Mono cho mọi mã phòng kho, mã hợp đồng và chuỗi PIN.
- **Do** áp dụng hiệu ứng chuyển động vi mô nhẹ nhàng (140ms – 180ms cubic-bezier).
- **Do** hiển thị rõ ràng nhãn đơn vị diện tích ($m^2$, $m^3$) và thời gian thuê (tháng).

### Don't:
- **Don't** sử dụng gradient tím - xanh phổ thông không thuộc nhận diện Boxora.
- **Don't** lồng thẻ bên trong thẻ (card inside card) gây rối mắt và làm dày độ sâu không cần thiết.
- **Don't** dùng màu xám nhạt khó đọc làm màu chữ phụ.
- **Don't** sử dụng hiệu ứng nảy (bounce/elastic easing) thiếu tính chuyên nghiệp, nghiêm túc của kho tự quản.
