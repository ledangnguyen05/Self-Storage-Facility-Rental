# DESIGN SYSTEM SPECIFICATION — BOXORA SMART STORAGE (StorageOps Pro)
> **Official Design Standard for Boxora Self-Storage Facility Rental & Management Platform**  
> *Author: Senior Product Designer & UI/UX Architect*  
> *Target Repository: `Self-Storage-Facility-Rental`*  
> *Core Typography: `Be Vietnam Pro` (100% website coverage)*  
> *Benchmark References: 5 Design Systems from Refero Styles (`Linear`, `teenage engineering`, `Intercom`, `Superhuman`, `Figma`)*

---

## 1. Executive Summary & Brand Direction

### 1.1. Business Context & Product Mission
**Boxora** is an enterprise-grade Smart Self-Storage Facility Rental & Operations Platform (StorageOps Pro). It bridges physical space storage (smart lockers, climate-controlled mini-warehouses, business document archives) with seamless digital commerce and real-time facility operations.

The platform serves four distinct user cohorts:
1. **Direct Customers (Renters):** Residential users (home renovation, moving, seasonal hobby storage) and SME business owners (inventory, files, equipment) seeking reliable, high-security space with instant online booking, transparent volumetric pricing, digital OTP contract signing, and dynamic IoT access credentials.
2. **Facility Staff & Cashiers:** Frontline operational team managing check-ins, physical handover inspections, security sealing, payment collection, cash journals, and immediate incident tickets.
3. **Facility & Business Managers:** Supervisors overseeing facility occupancy rates, dynamic pricing policies, unit maintenance, staff shift rosters, delinquent overdue escalations, and revenue KPIs.
4. **System Administrators:** Global administrators configuring branch facilities, locker tiers, IoT access rules, user permissions, and audit logs.

### 1.2. Design Personality & Experience Principles
- **Architectural Clarity & Industrial Precision:** Inspired by physical storage architecture and Swedish engineering—clean lines, precise dimensions, honest volumetric meters ($m^3$, $m^2$), and structured grids.
- **Reassuring Security & Trust:** Self-storage requires profound trust. The visual system uses authoritative cobalt blues, clear validation badges, structured security checklists, and unambiguous status indicators.
- **Zero-Latency Operational Density:** Administrative dashboards and cashier portals require dense, readable tabular data without visual clutter, with instant filters and accessible keyboard-friendly workflows.
- **Pure Vietnamese Typographic Harmony:** Built from the ground up around **Be Vietnam Pro**, ensuring every diacritic, tone mark, and uppercase accent renders crisply without clipping or awkward line jumps.

---

## 2. Research Benchmark — 5 Refero Styles Analysis

### 2.1. Linear (`https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1`)
- **Key Characteristics:** Midnight precision command center, hairline borders (0.5–1px), muted background surfaces (`#08090A`, `#0F1011`), high-contrast electric accents, compact padding (8–12px), rounded-md (6–8px) geometry.
- **Applied to Boxora:** Applied directly to the **StorageOps Pro Management Portals** (Manager, Operations, Admin, Cashier, Tickets). Replaced muddy shadows with hairline subtle borders (`rgba(226, 232, 240, 0.8)` in light mode, `rgba(255, 255, 255, 0.08)` in dark mode), precise micro-badges, keyboard shortcuts indicators, and focused filter pills.

### 2.2. teenage engineering (`https://styles.refero.design/style/aecf9dda-5cba-4dc7-9e73-59b65d895cdf`)
- **Key Characteristics:** Industrial studio product catalog on Canvas Mist (`#F6F8F7`), Ink Black (`#000000`), honest specification grids, geometric clarity, zero ornamental gradients, high contrast metadata.
- **Applied to Boxora:** Applied directly to the **Public Units Explorer, 3D Volumetric Calculator, and Storage Unit Cards**. Unit sizes (XS, S, M, L, XL), climate-control indicators, and dimensions ($L \times W \times H$) are displayed with industrial technical honesty rather than generic marketing cards.

### 2.3. Intercom (`https://styles.refero.design/style/12255b63-e506-4bc1-a4cd-d05487de32f3`)
- **Key Characteristics:** Warm editorial clarity, human conversational drawers, reassuring forms, highly legible form inputs, empathetic customer onboarding cards.
- **Applied to Boxora:** Applied directly to the **Customer Portal, Booking Flow, Contract Signing Stepper, Support Ticket Center, and Boxora Chat Widget**. Clear progress steppers, transparent price breakdowns, and polite feedback toasts.

### 2.4. Superhuman (`https://styles.refero.design/style/418b374a-be64-44f0-b17e-1d45308c7e62`)
- **Key Characteristics:** High-velocity triage, condensed split-pane layouts, immediate feedback loops, instant toggle controls, golden accent highlights.
- **Applied to Boxora:** Applied to the **Cashier Journal & Overdue Management**. Split-pane selection for fast unit inspections, immediate status toggling (Available $\leftrightarrow$ Reserved $\leftrightarrow$ Sealed), and quick action toolbars.

### 2.5. Figma (`https://styles.refero.design/style/5fd3b3b4-02ab-456a-87aa-e4395636b671`)
- **Key Characteristics:** Modular canvas with structural sidebar, clean tab switches, parameter inspect panels, consistent 2px focus rings.
- **Applied to Boxora:** Applied to the **DashboardLayout sidebar, Admin Facility Floorplan & Unit Configuration panels**. Structured navigation with breadcrumbs, facility switcher dropdown, and consistent focus states.

---

## 3. Typography System — 100% Be Vietnam Pro

To guarantee typographic consistency and perfection for Vietnamese and English text, **Be Vietnam Pro** is declared as the sole, non-negotiable primary typeface for the entire application.

```css
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

:root {
  --font-family-base: 'Be Vietnam Pro', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-family-heading: 'Be Vietnam Pro', sans-serif;
  --font-family-mono: 'JetBrains Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
```

### 3.1. Typographic Scale & Hierarchy
| Level | Font Size | Line Height | Weight | Letter Spacing | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display** | `2.5rem` (40px) | `1.15` | 800 (ExtraBold) | `-0.03em` | Hero landing headlines |
| **H1** | `2.0rem` (32px) | `1.2` | 700 (Bold) | `-0.025em` | Page titles, Portal headers |
| **H2** | `1.5rem` (24px) | `1.25` | 700 (Bold) | `-0.02em` | Section headers, Modal titles |
| **H3** | `1.25rem` (20px) | `1.3` | 600 (SemiBold) | `-0.015em` | Card titles, Grouping titles |
| **H4** | `1.0rem` (16px) | `1.4` | 600 (SemiBold) | `-0.01em` | Table headers, Sub-sections |
| **Body Large** | `1.0625rem` (17px) | `1.5` | 400 / 500 | `0` | Lead paragraphs, Hero descriptions |
| **Body Regular** | `0.9375rem` (15px) | `1.55` | 400 / 500 | `0` | Default body text, Form labels |
| **Body Small** | `0.8125rem` (13px) | `1.5` | 400 / 500 | `+0.01em` | Secondary metadata, helper text |
| **Caption / Badge** | `0.75rem` (12px) | `1.4` | 600 / 700 | `+0.03em` | Status chips, tags, timestamps |
| **Code / Code-Mono** | `0.875rem` (14px) | `1.4` | 500 / 600 | `0` | Unit Codes (`BX-102`), OTP, PINs, UUID |

---

## 4. Color Architecture & Design Tokens

### 4.1. Core Palette Tokens
```css
:root {
  /* Brand Primary: Authoritative Deep Modern Cobalt */
  --color-primary-50:  #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-200: #bfdbfe;
  --color-primary-500: #0d6efd;
  --color-primary-600: #0866f5; /* Primary Core */
  --color-primary-700: #0a58ca; /* Primary Hover */
  --color-primary-800: #064099; /* Primary Active */
  --color-primary-900: #042a66;

  /* Neutrals: Light Canvas */
  --color-canvas:       #f8fafc;
  --color-surface:      #ffffff;
  --color-surface-soft: #f1f5f9;
  --color-surface-dim:  #e2e8f0;
  --color-border:       #e2e8f0;
  --color-border-subtle: #f1f5f9;
  --color-border-strong: #cbd5e1;

  /* Typography Colors */
  --color-text-main:    #0f172a; /* Slate 900 */
  --color-text-muted:   #475569; /* Slate 600 */
  --color-text-subtle:  #64748b; /* Slate 500 */
  --color-text-inverse: #ffffff;

  /* Semantic Status Tokens */
  --color-status-success-bg:     #ecfdf5;
  --color-status-success-border: #a7f3d0;
  --color-status-success-text:   #065f46;

  --color-status-warning-bg:     #fffbeb;
  --color-status-warning-border: #fde68a;
  --color-status-warning-text:   #92400e;

  --color-status-danger-bg:      #fef2f2;
  --color-status-danger-border:  #fecaca;
  --color-status-danger-text:    #991b1b;

  --color-status-info-bg:        #eff6ff;
  --color-status-info-border:    #bfdbfe;
  --color-status-info-text:      #1e40af;
}

/* Dark Mode Tokens (StorageOps Midnight Substrate) */
.dark {
  --color-canvas:       #080c14;
  --color-surface:      #0e1526;
  --color-surface-soft: #162036;
  --color-surface-dim:  #1e293b;
  --color-border:       rgba(255, 255, 255, 0.08);
  --color-border-subtle: rgba(255, 255, 255, 0.04);
  --color-border-strong: rgba(255, 255, 255, 0.16);

  --color-text-main:    #f8fafc;
  --color-text-muted:   #94a3b8;
  --color-text-subtle:  #64748b;
  --color-text-inverse: #0f172a;

  --color-status-success-bg:     rgba(16, 185, 129, 0.12);
  --color-status-success-border: rgba(16, 185, 129, 0.3);
  --color-status-success-text:   #34d399;

  --color-status-warning-bg:     rgba(245, 158, 11, 0.12);
  --color-status-warning-border: rgba(245, 158, 11, 0.3);
  --color-status-warning-text:   #fbbf24;

  --color-status-danger-bg:      rgba(239, 68, 68, 0.12);
  --color-status-danger-border:  rgba(239, 68, 68, 0.3);
  --color-status-danger-text:    #f87171;

  --color-status-info-bg:        rgba(14, 165, 233, 0.12);
  --color-status-info-border:    rgba(14, 165, 233, 0.3);
  --color-status-info-text:      #38bdf8;
}
```

### 4.2. Storage Unit Domain Specific Badges
- **AVAILABLE (Còn trống):** Emerald Soft Badge (`bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20`)
- **RESERVED / ON_HOLD (Đang giữ chỗ):** Amber Soft Badge (`bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20`)
- **OCCUPIED (Đang thuê):** Blue/Indigo Badge (`bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20`)
- **OVERDUE (Quá hạn thanh toán):** Rose/Red Pulse Badge (`bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30`)
- **MAINTENANCE / SEALED (Đang bảo trì / Niêm phong):** Slate Neutral Badge (`bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20`)

---

## 5. Spacing, Geometry & Layout Architecture

### 5.1. Spacing Scale (4px / 8px Grid Base)
- `space-1`: `4px`
- `space-2`: `8px`
- `space-3`: `12px`
- `space-4`: `16px`
- `space-6`: `24px`
- `space-8`: `32px`
- `space-12`: `48px`
- `space-16`: `64px`

### 5.2. Border Radius System
- Hairline controls & badges: `rounded-md` (`6px`)
- Standard inputs & buttons: `rounded-lg` (`8px`)
- Card & container panels: `rounded-xl` (`12px`)
- Floating dialogs & modals: `rounded-2xl` (`16px`)
- Badges & Pills: `rounded-full` (`9999px`)
- **Rule:** Never use excessive pill rounding (>16px) on cards or square content surfaces to maintain architectural integrity.

### 5.3. Surface Elevation & Shadows
- **Base (Flat):** Zero shadow, separated solely by `1px solid var(--color-border)`.
- **Card Hover:** `0 4px 12px -2px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`
- **Modal / Popover:** `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.06)`

---

## 6. Component Specifications

### 6.1. Buttons (`Button.tsx`)
- **Primary:** `bg-[var(--color-primary-600)] text-white font-medium hover:bg-[var(--color-primary-700)] active:bg-[var(--color-primary-800)] shadow-xs transition-colors rounded-lg`
- **Secondary:** `bg-surface text-text-main border border-[var(--color-border)] hover:bg-surface-soft active:bg-surface-dim transition-colors rounded-lg`
- **Ghost:** `bg-transparent text-text-muted hover:text-text-main hover:bg-surface-soft rounded-lg`
- **Destructive:** `bg-red-600 text-white hover:bg-red-700 active:bg-red-800 rounded-lg`
- **Sizes:**
  - `sm`: Height `32px`, px `12px`, text `13px`
  - `md`: Height `40px`, px `16px`, text `14px`
  - `lg`: Height `48px`, px `24px`, text `16px`

### 6.2. Inputs & Selects (`Input.tsx`)
- Height `40px`, rounded-lg (`8px`), border `1px solid var(--color-border)`.
- Background: `var(--color-surface)`.
- Focus state: `border-[var(--color-primary-600)] ring-2 ring-[var(--color-primary-600)]/20 outline-none`.
- Clean clear label with required asterisk and unambiguous validation error text below.

### 6.3. Cards & Panels (`Card.tsx`)
- Border: `1px solid var(--color-border)`.
- Background: `var(--color-surface)`.
- Padding: `16px` (compact) or `24px` (regular).
- Structure: Clear Header (Title + Action), Content Body, optional Divider, Footer Actions.

### 6.4. Modals & Drawers (`Modal.tsx`)
- Backdrop: `rgba(15, 23, 42, 0.6)` with backdrop-blur-sm.
- Container: Centered, max-w-lg to max-w-4xl, rounded-2xl, border `1px solid var(--color-border)`.
- Explicit focus trap and Esc key dismissal.

### 6.5. Storage Units Explorer & Card
- Displays unit photo or 3D view toggle.
- Prominent Unit Code (`BX-S102`) in JetBrains Mono.
- Exact Dimensions: $Width \times Depth \times Height$ with calculated $m^2$ and $m^3$.
- Temperature & Humidity feature pill (Kho mát, Kiểm soát ẩm, Khóa thông minh).
- Transparent Monthly Price in VND, with deposit clearly stated.
- Instant CTA: "Đặt giữ chỗ ngay" or "Xem chi tiết 3D".

---

## 7. Responsive Breakpoint Guidelines
- **Mobile (`< 640px`):** Single column feed, sticky bottom checkout bar, bottom sheet modals, tap targets $\ge 44px$.
- **Tablet (`640px - 1024px`):** 2-column unit grid, collapsible sidebar navigation into overlay drawer.
- **Desktop (`1024px - 1440px`):** Persistent 260px sidebar for portals, 3-column unit explorer grid, split-pane cashier journal.
- **Large Screen (`> 1440px`):** Max container `1400px` for landing pages, full-width responsive dashboard tables with frozen action columns.

---

## 8. Definition of Done & Quality Checklist
- [x] Design System documentation complete in `design.md`.
- [x] Font `Be Vietnam Pro` loaded and set as global baseline font.
- [x] Shared UI components refactored (`Button`, `Card`, `Badge`, `Input`, `Modal`).
- [x] Shared Layouts refactored (`Navbar`, `Footer`, `DashboardLayout`, `NotificationCenter`).
- [x] All 7 Public routes refactored with the new design language.
- [x] All 9 Management/Customer Portal routes refactored with the new design language.
- [x] TypeScript builds with 0 errors (`npx tsc -b`).
- [x] Linter passes with 0 errors (`oxlint`).
- [x] Real business logic, state machines, API contracts, and non-production seed data preserved.
