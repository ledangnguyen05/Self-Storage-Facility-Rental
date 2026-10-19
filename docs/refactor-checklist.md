# BOXORA REFACTOR CHECKLIST & IMPLEMENTATION SCOPE

> **Project:** Boxora Self-Storage Facility Rental & Management (StorageOps Pro)  
> **Repository:** `d:\Self-Storage-Facility-Rental`  
> **Font:** `Be Vietnam Pro` (100% adoption across all components)

---

## 1. Routes & Page Audit Checklist

### 1.1. Public Routes
| Route | Page Component | Current Status | Refactor Scope |
| :--- | :--- | :--- | :--- |
| `/` & `/landing` | `HomePage.tsx` | Ready for Redesign | Hero, 3D Calculator section, Unit Tiers, Facility Highlights, FAQ, Testimonials |
| `/login` | `LoginPage.tsx` | Ready for Redesign | Card form, Google One-tap SSO integration, Demo Quick Login roles, Clean error banners |
| `/register` | `RegisterPage.tsx` | Ready for Redesign | Multi-step registration, phone validation, terms acceptance, cohesive typography |
| `/reset-password` | `ResetPasswordPage.tsx` | Ready for Redesign | Email verification, password reset tokens, security tips |
| `/units` | `UnitsExplorerPage.tsx` | Ready for Redesign | Facility filter, size tabs (XS/S/M/L/XL), 3D volumetric preview, unit cards, booking modal |
| `/payment-result` | `PaymentResultPage.tsx` | Ready for Redesign | VNPay / MoMo return handler, payment receipt card, contract activation CTA |
| `/terms` | `TermsAndStandardsPage.tsx` | Ready for Redesign | Tabbed regulatory policies, storage rules, fire safety, liability, prohibited items |

### 1.2. StorageOps Pro Portal Routes (Protected)
| Route | Page Component | Allowed Roles | Refactor Scope |
| :--- | :--- | :--- | :--- |
| `/portal/customer` | `CustomerDashboard.tsx` | CUSTOMER, ADMIN | My Units, Active Contracts, Digital Signing (OTP), Payment History, Incident Tickets |
| `/portal/staff` | `StaffDashboard.tsx` | STAFF, ADMIN | Daily Handover Queue, Check-in / Check-out, Physical Security Sealing, Storage Inspection |
| `/portal/facility-manager`| `ManagerDashboard.tsx` | FACILITY_MANAGER, BM, ADMIN | Occupancy KPIs, Unit Maintenance, Emergency Overrides, Facility Policies |
| `/portal/business-manager`| `OperationsDashboard.tsx`| BUSINESS_MANAGER, ADMIN | Revenue Analytics, Delinquency Tracking, Branch Performance, Pricing Engine |
| `/portal/admin` | `AdminDashboard.tsx` | ADMIN, BUSINESS_MANAGER | System Audit, User Management, Facility Configuration, IoT Master Keys |
| `/portal/cashier` | `CashierJournalPage.tsx`| STAFF, FM, BM, ADMIN | Cash drawer reconciliation, receipt printing, transaction log |
| `/portal/tickets` | `IncidentTicketsPage.tsx`| STAFF, FM, BM, ADMIN | Customer & Facility Incident Ticketing, SLA prioritization, image attachments |
| `/portal/overdue` | `OverdueManagementPage.tsx`| FM, BM, ADMIN | Delinquent accounts, automated reminder SMS/Email, legal notice, auction sealing |
| `/portal/shifts` | `ShiftRosterPage.tsx` | FM, BM, ADMIN | Guard & front-desk shift rosters, check-in logs, staff assignment notes |

---

## 2. Shared Layouts & Components Checklist

### 2.1. Shared Layouts
- [x] `src/components/layout/Navbar.tsx`: Unified header, responsive mobile drawer, facility indicator, authenticated profile menu.
- [x] `src/components/layout/Footer.tsx`: Modern industrial footer, licensing, security certifications, quick links, branch directory.
- [x] `src/components/layout/DashboardLayout.tsx`: Collapsible 260px sidebar, breadcrumbs, search shortcut (`Cmd+K`), notification trigger, role badge.
- [x] `src/components/layout/NotificationCenter.tsx`: Real-time notification drawer, mark all read, priority badges.

### 2.2. Shared UI Foundation (`src/components/ui/`)
- [x] `Button.tsx`: Primary, secondary, outline, ghost, destructive, with loading spinners and Be Vietnam Pro typography.
- [x] `Card.tsx`: Structural 1px border, neutral canvas, clear header/body/footer divisions.
- [x] `Badge.tsx`: Domain-specific storage status badges (Available, Reserved, Occupied, Overdue, Sealed).
- [x] `Input.tsx`: Floating labels, clear validation messages, icon adornments, accessible focus rings.
- [x] `Modal.tsx`: Accessible dialogs with animated backdrop, escape key handler, proper z-index elevation.

### 2.3. Common Widgets & Floating Components
- [x] `BrandLogo.tsx`: SVG architectural logo with crisp geometric Boxora mark.
- [x] `BoxoraChatWidget.tsx`: AI assistant drawer with Gemini integration and storage advisory flows.
- [x] `FloatingContactWidget.tsx`: Quick hotline, Zalo, WhatsApp, direct emergency call.
- [x] `QuickThemeLanguageToggle.tsx`: Seamless Dark/Light mode and EN/VI switcher.
- [x] `UserAvatarDropdown.tsx`: Profile preview, role indicator, quick settings, logout trigger.

---

## 3. Verification & Testing Standards
- [x] TypeScript compilation: `npx tsc -b` -> 0 errors.
- [x] Code Linting: `npm run lint` (`oxlint`) -> 0 errors.
- [x] Production Build: `npm run build` -> Success (`vite v8.3.0 building client environment for production... ✓ built in 601ms`).
- [x] Visual Regression & Responsiveness: Validated across 375px, 768px, 1024px, 1440px.
