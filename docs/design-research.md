# DESIGN RESEARCH & BENCHMARK REPORT
> **Deep Analysis of 5 Design Systems from Refero Styles (`https://styles.refero.design/`)**  
> *Target Project: Boxora Smart Storage (StorageOps Pro)*  
> *Repository: `Self-Storage-Facility-Rental`*

---

## 1. Introduction & Methodology
To overhaul Boxora from an ad-hoc interface into a unified, commercial-grade product, we surveyed the design systems of 5 products on Refero Styles. These selections span modern DevTools, high-density operations dashboards, industrial e-commerce catalogs, and empathetic customer communication systems.

---

## 2. Detailed Breakdown of 5 Refero Styles

### 2.1. Linear — Midnight Precision Instrument
- **Refero URL:** [https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1](https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1)
- **Official Website:** `https://linear.app`
- **Category:** Dev Tools / Project Operations
- **Core Visual Identity:**
  - Base canvas: Void `#08090A`, Carbon `#0F1011`, Obsidian `#161718`.
  - Contrast: Crisp white text with tight tracking (`-0.022em`), font weights residing in a controlled 400–550 band.
  - Border geometry: Hairline 0.5px to 1px borders in Graphite `#23252A` and Smoke `#383B3F`.
  - Distinctive Accent: Electric acid lime `#E4F222` used strictly as a flashlight signal for primary action, breaking monochrome calmness without visual clutter.
- **Components & Layouts:**
  - Fast keyboard shortcuts (`K`, `/`, `Cmd+P`).
  - Dense kanban columns and ticket lists with zero wasted padding (compact 8–12px padding).
  - Micro-badges with subtle borders indicating priority, assigned staff, and lifecycle status.
- **Application to Boxora:**
  - StorageOps Pro management dashboards (Operations, Shift Rosters, Incident Tickets, Overdue Collections).
  - Replaced heavy box-shadows with subtle 1px structural borders and crisp monochrome badge semantics.

---

### 2.2. teenage engineering — Industrial Catalogue Under Studio Light
- **Refero URL:** [https://styles.refero.design/style/aecf9dda-5cba-4dc7-9e73-59b65d895cdf](https://styles.refero.design/style/aecf9dda-5cba-4dc7-9e73-59b65d895cdf)
- **Official Website:** `https://teenage.engineering`
- **Category:** E-commerce / Industrial Hardware
- **Core Visual Identity:**
  - Base canvas: Canvas Mist `#F6F8F7`, Ink Black `#000000`, Steel Gray `#E5E5E5`.
  - Zero decorative drop-shadows, zero excessive border-radius. Every edge is a straight or slightly softened geometric cut.
  - Typographic whisper: Ultra-thin high-contrast type (`te-20`, `te-40`) where products and their real-world dimensions are the dense hero elements.
- **Components & Layouts:**
  - Honest technical specification tables ($L \times W \times H$, weight, volume, power).
  - High-precision modular grid displaying equipment and modules.
- **Application to Boxora:**
  - Storage Units Explorer, Unit Cards, and 3D Volumetric Space Calculator.
  - Instead of generic vague product cards, each storage locker displays exact physical specs: Volume in $m^3$, Floor Area in $m^2$, Door Clearance, Climate Control status, and Security Pin mechanism.

---

### 2.3. Intercom — Warm Human Editorial Spread
- **Refero URL:** [https://styles.refero.design/style/12255b63-e506-4bc1-a4cd-d05487de32f3](https://styles.refero.design/style/12255b63-e506-4bc1-a4cd-d05487de32f3)
- **Official Website:** `https://intercom.com`
- **Category:** Customer Engagement & Communication
- **Core Visual Identity:**
  - Warm cream and editorial surfaces, approachable enterprise typography.
  - High legibility, empathetic microcopy, reassuring feedback toasts, and clear progress steppers.
- **Components & Layouts:**
  - Smooth slide-out drawers, accessible contact widgets, and conversational ticket cards.
  - Forms with distinct labels, clear helper text, and real-time validation states.
- **Application to Boxora:**
  - Customer Portal, Rental Booking Stepper, Contract Digital Signing Modal (OTP/Handshake), and Boxora AI Smart Assistant Chat Widget.
  - Gives customers total transparency on rental contracts, monthly fees, deposit refunds, and immediate emergency contact numbers.

---

### 2.4. Superhuman — Golden Hour High-Velocity Productivity
- **Refero URL:** [https://styles.refero.design/style/418b374a-be64-44f0-b17e-1d45308c7e62](https://styles.refero.design/style/418b374a-be64-44f0-b17e-1d45308c7e62)
- **Official Website:** `https://superhuman.com`
- **Category:** Productivity / High Velocity Inbox
- **Core Visual Identity:**
  - Deep rich dark mode with warm amber/gold accents, instant zero-latency feedback.
  - Split-pane interface allowing instant inspection of selected items without navigating away from the list.
- **Components & Layouts:**
  - Rapid action toolbar, immediate status triage (Unpaid, Paid, Delinquent, Sealed).
  - High density rows that maximize screen real estate for power users.
- **Application to Boxora:**
  - Cashier Journal & Overdue Delinquency Management.
  - Staff and managers can inspect a contract, check overdue days, trigger payment reminders, or record physical security seals in a single split-view without page reloads.

---

### 2.5. Figma — Modular Canvas & Inspect Tooling
- **Refero URL:** [https://styles.refero.design/style/5fd3b3b4-02ab-456a-87aa-e4395636b671](https://styles.refero.design/style/5fd3b3b4-02ab-456a-87aa-e4395636b671)
- **Official Website:** `https://figma.com`
- **Category:** Design Tools / Collaborative Workspace
- **Core Visual Identity:**
  - Clean neutral slate workspace with purposeful cobalt and violet accents.
  - Consistent 2px focus ring (`ring-2 ring-primary/30`), clear tab switches, structured properties sidebar.
- **Components & Layouts:**
  - Tree-views for facilities, floors, and unit blocks.
  - Floating toolbars, segmented controls, and uniform modal dialogs.
- **Application to Boxora:**
  - DashboardLayout sidebar, Admin Facility & Floor Configuration panels, and Unit Type tier managers.

---

## 3. Synthesis: The Boxora StorageOps Pro Design Language
By combining the **industrial honesty of teenage engineering**, the **operational precision of Linear**, the **human warmth of Intercom**, the **rapid triage speed of Superhuman**, and the **modular discipline of Figma**, Boxora achieves a unified, premium, and durable design system tailored specifically for smart self-storage management.
All wrapped in **Be Vietnam Pro** typography for flawless Vietnamese and English presentation.
