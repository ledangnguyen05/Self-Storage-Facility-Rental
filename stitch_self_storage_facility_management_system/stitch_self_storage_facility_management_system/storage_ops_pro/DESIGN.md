---
name: Storage Ops Pro
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#a73a00'
  on-secondary: '#ffffff'
  secondary-container: '#fd651e'
  on-secondary-container: '#571a00'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#00174b'
  on-tertiary-container: '#497cff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#ffdbce'
  secondary-fixed-dim: '#ffb599'
  on-secondary-fixed: '#370e00'
  on-secondary-fixed-variant: '#7f2b00'
  tertiary-fixed: '#dbe1ff'
  tertiary-fixed-dim: '#b4c5ff'
  on-tertiary-fixed: '#00174b'
  on-tertiary-fixed-variant: '#003ea8'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  unit-code:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.06em
  data-tabular:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system embodies an industrial-tech aesthetic engineered for self-storage rental and operations management. The visual tone is authoritative, highly structured, and utilitarian, balanced by contemporary software ergonomics. It projects absolute physical and digital security, inventory precision, and seamless operational flow.

The target audience spans commercial and personal storage tenants seeking rapid leasing, transparent dimensions, and digital gate access, alongside facility managers juggling high-density occupancy maps, automated billing, and unit maintenance pipelines.

### Design Movement & Character
The interface draws heavily from **Corporate Precision & Modern Industrial Utility**:
- **Information Density:** High visual hierarchy calibrated for high-throughput operational screens, spatial maps, and dense tabular ledgers.
- **Architectural Clarity:** Layouts mimic physical blueprint blueprints and structural frameworks through clean structural divisions, disciplined rhythm, and crisp delineation.
- **Instrumental Feedback:** State changes, security alerts, and door statuses mirror modern smart-access hardware interfaces, blending industrial safety cues with intuitive SaaS design.

## Colors

The system employs a disciplined, safety-engineered color strategy designed for maximum legibility in complex spatial diagrams and financial management tools.

### Foundation Tones
- **Primary Navy (`#0F172A`, `#1E293B`):** Establishes structural authority, housing sidebars, headers, key text layers, and primary navigational states.
- **Interactive Blue (`#2563EB`):** Reserved for primary interactive digital paths, link selections, and key focus states.
- **Safety Industrial Amber/Orange (`#EA580C`, `#F59E0B`):** Evokes heavy equipment, architectural safety markers, unit warnings, and prominent lease calls-to-action.
- **Surface Canvas (`#F8FAFC`, `#F1F5F9`, `#FFFFFF`):** High-efficiency neutral background canvas providing crisp separation for interactive unit matrices and complex data tables.

### Operational Semantic Spectrum
Status colors reflect inventory and facility condition directly:
- **Available (`#10B981`):** Ready-to-rent units, confirmed payments, active access badges.
- **Rented / Active (`#6366F1`):** Occupied inventory, verified active leases.
- **Pending / Action Needed (`#F59E0B`):** Handover pending, inspection required, unsigned agreements.
- **Maintenance / Lockout (`#EF4444`):** Damaged shutter, pest control, lock replacement, safety hold.
- **Overdue / Delinquent (`#8B5CF6`):** Past-due invoices, gate lockout protocols initiated.

## Typography

The type system blends the geometric authority of **Plus Jakarta Sans** for section titling and facility metrics with the clarity of **Inter** for data grids and transactional UI.

### Tabular and Industrial Formatting
All unit dimensions (`10×15 ft`, `7.5 m²`, `22.5 m³`), price metrics, IDs (`#A-104`, `#C-802`), and live access timestamps must utilize the OpenType feature `tnum` (tabular figures) to ensure column alignment in dense lists and unit cards. 

Unit codes utilize uppercase tracking for immediate scan speed across operations dashboards and keypads.

## Layout & Spacing

The layout is built around a rigorous 8px base rhythm, optimizing horizontal and vertical space to accommodate interactive facility floor plans alongside contextual action panels.

### Grid Architecture
- **Desktop (1280px+):** 12-column adaptive layout with 24px gutters. Workspaces are configured with a persistent 280px operational utility sidebar, a fluid central canvas for facility mapping or unit matrices, and an optional 360px contextual slide-in drawer for unit telemetry and contract forms.
- **Tablet (768px - 1279px):** 8-column layout with 16px gutters and collapsible navigation rail.
- **Mobile (<768px):** 4-column layout with 16px margins, stacking floor-plan selectors above bottom sheets for unit booking and gate access switches.

### Density Tiers
- **Comfort:** Applied to onboarding, checkout, and tenant self-service screens (`space-lg` and `space-xl` gaps).
- **Compact:** Applied to facility map matrices, gate access ledgers, and tabular revenue logs (`space-xs` and `space-sm` gaps) to prioritize immediate visibility without scrolling.

## Elevation & Depth

This design system uses a structural depth model rooted in flat industrial layering, subtle boundary borders, and ambient light distribution. Strong shadows are eliminated in favor of clean edge contrast.

### Layering Hierarchy
1. **Canvas Level (Base):** `#F8FAFC`. Houses background floor grids and architectural footprints.
2. **Structural Tier (Level 1):** `#FFFFFF`, bound with crisp 1px borders in `#E2E8F0`. Applied to primary cards, table bodies, and static unit containers.
3. **Elevated Elements (Level 2):** `#FFFFFF` with a clean dual-ring shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)` and border `#CBD5E1`. Used for hover-state floor plan units, toolbars, and contextual popovers.
4. **Modal / Critical Overlay (Level 3):** Deep backdrop overlay (`#0F172A` at 65% opacity) supporting centered modals and full-height slide-over inspection drawers, shadowed with `0 20px 25px -5px rgba(15, 23, 42, 0.15)`.

## Shapes

The interface balances robust engineering corners with approachable rounded corners. 

- **Primary Cards & Large Sheets:** Utilize `1rem` (`rounded-xl`) to establish friendly structure while framing technical equipment data.
- **Interactive Buttons, Table Rows, Inputs:** Standardized at `0.5rem` (`rounded-md`) to ensure precise alignment with grid boundaries and data tables.
- **Badges, Tags, Unit Indicators:** Use pill rounding or strict soft corners depending on function (pills for status tags; soft rectangles for physical unit identification tags).

## Components

### Buttons
- **Primary Industrial:** Solid `#0F172A` with `#FFFFFF` text, `0.5rem` border radius, high-contrast hover shift to `#1E293B`.
- **Accent Action:** Solid `#EA580C` with `#FFFFFF` text for "Rent Unit Now", "Overdue Notice", or "Unlock Gate". Hover transitions to `#C2410C`.
- **Secondary Utility:** Clean `#FFFFFF` fill with 1px `#CBD5E1` border and `#1E293B` text.
- **States:** Height standards are 40px for standard actions and 32px for in-table micro-actions.

### Status Chips & Badges
- Constructed with light tinted backgrounds and dark foregrounds for high contrast:
  - **Available:** Bg `#ECFDF5`, Text `#047857`, Border `#A7F3D0`.
  - **Rented:** Bg `#EEF2FF`, Text `#4338CA`, Border `#C7D2FE`.
  - **Pending:** Bg `#FFFBEB`, Text `#B45309`, Border `#FDE68A`.
  - **Maintenance:** Bg `#FEF2F2`, Text `#B91C1C`, Border `#FECACA`.
  - **Delinquent:** Bg `#FAF5FF`, Text `#6B21A8`, Border `#E9D5FF`.

### Storage Unit Grid Cards (Floor Map Representation)
- Structured miniature cards featuring:
  - Unit ID Header (e.g., `#B-108`) in `unit-code` style with strong contrast background.
  - Dimension Tag (e.g., `10×10 ft • 100 sq ft`) using tabular typography.
  - Climate-controlled / Roll-up door iconography.
  - Real-time status band along the top or left border (4px semantic color bar).
  - Hover state adds Level 2 elevation and reveals instant quick-actions ("Details", "Hold", "Unlock").

### Data Tables
- Sticky headers with `#F1F5F9` background, 11px uppercase labels, and subtle sort arrows.
- Alternating row hover (`#F8FAFC`) with numeric and dimension columns explicitly right-aligned using tabular figures.
- Inline action buttons grouped in rightmost column, visible upon row hover.

### Inputs & Unit Filter Bar
- Form fields feature 1px `#CBD5E1` borders, changing to 2px `#2563EB` on focus with zero layout shift.
- Modular filter toolbar featuring quick-segment controls: floor level switches (`Floor 1`, `Floor 2`), climate control toggles (`Climate`, `Standard`), and size brackets (`Small 25-50ft²`, `Medium 51-150ft²`, `Large 151ft²+`).