# DESIGN SYSTEM — PREMIUM LIGHT REACT

> Aesthetic direction: **Editorial · Swiss · Modern Product · Premium Minimal**
>
> Technology: **React + TypeScript**
>
> Primary goal: Build a polished, highly usable, smooth and visually distinctive light-mode interface that feels intentionally designed by a professional product designer — **not AI-generated, not template-heavy, and not visually repetitive**.

---

# 01. DESIGN PHILOSOPHY

The interface must feel:

* Clean
* Bright
* Elegant
* Calm
* Premium
* Precise
* Modern
* Human-designed
* Visually intentional
* Fast and responsive

The interface must NOT feel:

* Generic AI SaaS
* Template-generated
* Over-designed
* Excessively rounded
* Excessively animated
* Dark
* Neon
* Cyberpunk
* Glassmorphism-heavy
* Gradient-heavy
* Filled with unnecessary cards
* Filled with generic stock illustrations
* Filled with excessive icons

## Core principle

> **Less decoration. More composition.**

Premium appearance should come from:

1. Typography
2. Layout
3. Whitespace
4. Grid
5. Visual hierarchy
6. Motion
7. Consistency
8. High-quality details

Do not attempt to create a premium appearance by simply adding:

* gradients
* blur
* shadows
* glass
* glowing borders
* excessive animations
* huge rounded cards

---

# 02. TECHNOLOGY

Use:

* React
* TypeScript
* CSS / Tailwind CSS
* Framer Motion or Motion for React
* Lucide React for icons

Recommended architecture:

```text
src/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── navigation/
│   ├── sections/
│   └── feedback/
│
├── pages/
│
├── hooks/
│
├── lib/
│
├── styles/
│   ├── globals.css
│   ├── tokens.css
│   └── animations.css
│
└── assets/
```

Components should be:

* reusable
* composable
* accessible
* responsive
* independently testable
* visually consistent

Avoid creating one huge component containing the entire page.

---

# 03. COLOR SYSTEM

The website is **LIGHT MODE FIRST**.

## Primary colors

```css
--background: #F7F7F5;
--surface: #FFFFFF;
--surface-subtle: #F2F2EF;

--foreground: #111111;
--foreground-secondary: #555555;
--foreground-muted: #8A8A8A;

--border: #E5E5E1;
--border-strong: #D5D5D0;

--accent: #2457FF;
--accent-soft: #EAF0FF;
```

## Semantic colors

```css
--success: #168A55;
--success-soft: #EAF7F0;

--warning: #B7791F;
--warning-soft: #FFF6E5;

--danger: #D64545;
--danger-soft: #FDECEC;

--info: #3269D8;
--info-soft: #EDF3FF;
```

## Color rules

Use approximately:

```text
85% — neutral colors
10% — typography / borders
5%  — accent
```

The accent color must be intentional.

Do not use multiple competing accent colors unless the product domain requires semantic colors.

Avoid:

```text
purple + pink + blue gradients
neon green
neon purple
rainbow gradients
dark backgrounds
glowing UI
```

## Background rule

Do not use pure white everywhere.

Prefer:

```text
Page       #F7F7F5
Surface    #FFFFFF
Subtle     #F2F2EF
```

This creates depth without relying on shadows.

---

# 04. TYPOGRAPHY

Typography is one of the primary visual identities.

Recommended fonts:

### Primary

```text
Inter
```

### Alternative

```text
Manrope
Instrument Sans
Plus Jakarta Sans
```

Maximum:

```text
2 font families
```

Recommended:

```text
Headings → Instrument Sans / Manrope
Body     → Inter
```

Do not use more than two font families.

---

# 05. TYPE SCALE

Desktop:

```text
Display      72–88px
Hero         56–72px
H1           48–56px
H2           36–44px
H3           28–32px
H4           22–24px

Body Large   18px
Body         16px
Body Small   14px

Caption      12–13px
```

Mobile:

```text
Display      44–52px
Hero         40–48px
H1           36–42px
H2           30–34px
H3           24–28px
Body         16px
Caption      12–13px
```

## Typography rules

Headings:

```css
font-weight: 600;
letter-spacing: -0.03em;
line-height: 1.05;
```

Body:

```css
font-weight: 400;
line-height: 1.6;
```

Do not make everything bold.

Use weight to create hierarchy:

```text
400 → body
500 → navigation / labels
600 → headings
700 → rare emphasis
```

Avoid excessive uppercase text.

Uppercase should primarily be used for:

* labels
* categories
* metadata
* small navigation elements

---

# 06. GRID SYSTEM

Desktop:

```text
12-column grid
max-width: 1280px
horizontal padding: 32px
gutter: 24px
```

Large screens:

```text
max-width: 1280–1440px
```

Tablet:

```text
8-column grid
```

Mobile:

```text
4-column grid
padding: 20px
gutter: 16px
```

Recommended container:

```css
max-width: 1280px;
margin-inline: auto;
padding-inline: 32px;
```

Mobile:

```css
padding-inline: 20px;
```

Do not center every element.

Prefer:

```text
left alignment
strong grid
intentional asymmetry
```

Center alignment should be reserved for:

* selected hero layouts
* short statements
* empty states
* final CTA
* certain marketing sections

---

# 07. SPACING SYSTEM

Use an 8px-based spacing system.

```text
4
8
12
16
20
24
32
40
48
64
80
96
120
144
160
```

Typical usage:

```text
Icon → text             8px
Text → text             12px
Button internal         12–16px
Card padding            24px
Large card padding      32px
Component spacing       24–48px
Section spacing         80–128px
Hero spacing            120–160px
```

Never choose random spacing values without a reason.

---

# 08. BORDER RADIUS

Use restrained radius.

```text
Small UI        6px
Buttons         8px
Inputs          8px
Cards           12px
Large surfaces  16px
```

Avoid:

```text
24px everywhere
32px everywhere
pill-shaped everything
```

A professional interface does not need every object to look like a floating bubble.

---

# 09. SHADOW SYSTEM

Shadows should be subtle.

Default:

```css
box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
```

Elevated:

```css
box-shadow: 0 12px 40px rgba(0, 0, 0, 0.06);
```

Strong:

```css
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
```

Do not use heavy shadows.

Never create:

```text
black floating cards
huge glowing shadows
colored neon shadows
```

Borders should usually provide most of the visual separation.

---

# 10. SURFACE SYSTEM

Use three primary surface levels.

## Level 0

```text
Page background
#F7F7F5
```

## Level 1

```text
Primary surface
#FFFFFF
```

## Level 2

```text
Subtle surface
#F2F2EF
```

Cards should not always be visually separated from the page.

Sometimes use:

```text
border only
```

Sometimes:

```text
background only
```

Sometimes:

```text
border + very subtle shadow
```

Avoid applying the same treatment to every component.

---

# 11. NAVIGATION

Navbar height:

```text
64–72px
```

Desktop structure:

```text
Logo

Product
Solutions
Resources
Pricing

Login
Primary CTA
```

Keep navigation visually quiet.

Do not use:

* giant navbar
* excessive dropdowns
* glowing buttons
* oversized logo
* excessive pill navigation

### Sticky navigation

When sticky:

```text
background: rgba(255,255,255,0.86)
backdrop-filter: blur(12px)
border-bottom: 1px solid var(--border)
```

Use blur sparingly.

The navbar should remain lightweight.

---

# 12. BUTTON SYSTEM

Buttons must feel tactile and precise.

## Primary button

```text
Background: #111111
Text: #FFFFFF
Height: 44–48px
Radius: 8px
Padding: 16–20px
```

Hover:

```text
translateY(-1px)
background slightly lighter
```

Active:

```text
translateY(0)
scale(0.98)
```

## Secondary button

```text
Background: transparent
Border: #DCDCD8
Text: #111111
```

Hover:

```text
background: #FFFFFF
border: darker
```

## Text button

Use for low-priority actions.

```text
Learn more →
View details →
```

Do not create every action as a button.

---

# 13. ICON SYSTEM

Use one icon family.

Recommended:

```text
Lucide React
```

Default:

```text
18–20px
stroke-width: 1.75–2
```

Large:

```text
24px
```

Avoid mixing:

```text
Lucide
Font Awesome
random SVG
emoji
```

Do not use icons merely to decorate empty space.

Every icon should have a purpose.

---

# 14. CARDS

Cards are optional, not mandatory.

Do not structure every section as:

```text
Card
Card
Card
```

Prefer multiple layout patterns.

### Pattern A — editorial list

```text
01  Feature title
    Description
──────────────────────

02  Feature title
    Description
──────────────────────
```

### Pattern B — split layout

```text
TEXT                    IMAGE
TEXT                    IMAGE
```

### Pattern C — large feature

```text
┌──────────────────────────────┐
│                              │
│        PRODUCT VISUAL        │
│                              │
└──────────────────────────────┘
```

### Pattern D — grid

Use cards only when grouping information is useful.

---

# 15. HERO DESIGN

The hero must establish the product identity immediately.

Recommended structure:

```text
SMALL LABEL

Large headline.
Large headline.

Short, specific supporting statement.

[ Primary CTA ]  [ Secondary CTA ]

                 Product visual
```

Avoid generic copy such as:

```text
Revolutionize your workflow.
Unlock your potential.
The future of everything.
Next-generation solution.
Powerful AI-powered platform.
```

Prefer concrete copy.

Example:

```text
Ship your next release
without the busywork.

A focused workspace for teams
that want to move from idea to production faster.
```

The exact copy depends on the product.

---

# 16. HERO VISUAL

Preferred visual hierarchy:

1. Real product UI
2. Custom illustration
3. Data visualization
4. Editorial photography
5. Typography composition
6. Abstract graphics

Avoid generic:

```text
3D blobs
floating glass cards
purple AI brains
robot illustrations
random gradients
```

The visual should communicate the product.

---

# 17. SECTION DESIGN

Do not repeat the same layout.

Use rhythm.

Recommended page:

```text
01 HERO

02 SOCIAL PROOF

03 LARGE STATEMENT

04 PRODUCT FEATURE

05 FEATURE LIST

06 PRODUCT VISUAL

07 DATA / METRICS

08 TESTIMONIAL

09 FAQ

10 CTA

11 FOOTER
```

Each section should have a different visual rhythm.

---

# 18. EDITORIAL DETAILS

Use small metadata elements:

```text
01 — PLATFORM
02 — AUTOMATION
03 — ANALYTICS
```

Example:

```text
01

AUTOMATION

Remove repetitive work
from your team's workflow.
```

This creates an editorial/product-design feeling without adding unnecessary decoration.

---

# 19. ASYMMETRY

Do not force every section to be perfectly symmetrical.

Use intentional asymmetry.

Example:

```text
        TEXT
        TEXT
        TEXT

                         IMAGE
                         IMAGE
```

or:

```text
IMAGE

             TEXT
             TEXT
```

Asymmetry should follow the grid.

Never use random positioning simply to appear creative.

---

# 20. IMAGES

Images should have strong visual purpose.

Preferred:

* product screenshots
* editorial photography
* architecture
* product details
* abstract textures
* custom diagrams
* real UI previews

Avoid generic stock photography.

If photography is used:

```text
consistent aspect ratio
consistent treatment
consistent cropping
```

Do not mix random image styles throughout the same page.

---

# 21. ANIMATION PHILOSOPHY

Animation should communicate:

* hierarchy
* state
* continuity
* feedback
* spatial relationships

Animation must NOT exist just to impress.

Core rule:

> If removing the animation makes the interface easier to understand, remove it.

---

# 22. ANIMATION TIMING

Use:

```text
Micro interaction     120–180ms
Small transition      180–240ms
Standard transition   240–350ms
Large transition      350–500ms
Page entrance         500–800ms
```

Avoid:

```text
1.5s+
```

for normal UI interactions.

---

# 23. EASING

Use smooth easing.

Recommended:

```css
cubic-bezier(0.22, 1, 0.36, 1)
```

For subtle UI:

```css
ease-out
```

Avoid overly mechanical linear transitions.

---

# 24. HOVER ANIMATION

Buttons:

```text
translateY(-1px)
```

Images:

```text
scale(1.015–1.03)
```

Cards:

```text
translateY(-2px)
```

Links:

```text
arrow moves 3–5px
```

Do not combine:

```text
scale + rotate + glow + blur + translate
```

One or two properties are enough.

---

# 25. SCROLL REVEAL

Use subtle reveal animations.

Recommended:

```text
opacity: 0 → 1
translateY: 16px → 0
```

Duration:

```text
500–700ms
```

Stagger:

```text
50–100ms
```

Do not animate every single paragraph independently.

Group related elements.

---

# 26. PAGE LOAD ANIMATION

The first viewport may use a subtle sequence:

```text
Navbar
↓
Eyebrow
↓
Headline
↓
Description
↓
CTA
↓
Product visual
```

Use small stagger values.

Example:

```text
0ms
80ms
160ms
240ms
320ms
```

The page must still feel fast.

Never make the user wait for the animation.

---

# 27. FRAMER MOTION / MOTION

Recommended React pattern:

```tsx
import { motion } from "motion/react";

<motion.div
  initial={{ opacity: 0, y: 16 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.2 }}
  transition={{
    duration: 0.6,
    ease: [0.22, 1, 0.36, 1],
  }}
>
  {children}
</motion.div>
```

Animations must respect reduced motion.

Example:

```tsx
const prefersReducedMotion = useReducedMotion();
```

If reduced motion is enabled:

```text
remove transform animations
reduce transitions
keep content immediately visible
```

---

# 28. MICRO INTERACTIONS

Use micro interactions for:

### Buttons

```text
hover → subtle lift
active → slight press
```

### Links

```text
arrow → moves slightly
```

### Inputs

```text
focus → border/accent transition
```

### Toggles

```text
smooth thumb movement
```

### Navigation

```text
active indicator → smooth movement
```

Micro interactions should feel almost invisible.

The user should feel that the interface is responsive rather than notice an animation.

---

# 29. INPUTS

Input height:

```text
44–48px
```

Radius:

```text
8px
```

Default:

```text
background: #FFFFFF
border: #DCDCD8
```

Focus:

```text
border: accent
box-shadow: 0 0 0 3px accent-soft
```

Never use giant glowing focus effects.

Error state must be explicit.

Do not rely on color alone.

---

# 30. TABLES

Tables should prioritize readability.

Use:

```text
horizontal borders
subtle hover
clear column alignment
compact typography
```

Avoid putting every row inside a rounded card.

Header:

```text
12–13px
font-weight: 600
```

Body:

```text
14–16px
```

---

# 31. MODALS

Modal:

```text
max-width: 480–640px
background: #FFFFFF
border-radius: 16px
border: 1px solid var(--border)
```

Overlay:

```text
rgba(17,17,17,0.24)
```

Animation:

```text
opacity
scale: 0.98 → 1
translateY: 8px → 0
```

Duration:

```text
200–300ms
```

---

# 32. TOAST / NOTIFICATIONS

Toast should be compact.

Position:

```text
bottom-right
```

Animation:

```text
translateY(12px) → 0
opacity 0 → 1
```

Avoid huge notification banners.

---

# 33. LOADING STATES

Never freeze the UI.

Use:

* skeletons
* subtle progress indicators
* optimistic updates where appropriate

Skeletons:

```text
background: #ECECE8
border-radius: 6px
```

Animation should be subtle.

Avoid aggressive shimmer.

---

# 34. EMPTY STATES

Empty states should be calm.

Structure:

```text
small icon

Nothing here yet.

Short explanation.

[ Primary action ]
```

Do not use giant illustrations unless they communicate something useful.

---

# 35. ERROR STATES

Errors must be:

* clear
* specific
* actionable
* non-threatening

Avoid:

```text
Something went horribly wrong!!!
```

Prefer:

```text
We couldn't load your projects.

Check your connection and try again.
```

Provide recovery action where possible.

---

# 36. RESPONSIVE DESIGN

Desktop:

```text
1280px+
```

Tablet:

```text
768–1279px
```

Mobile:

```text
<768px
```

Mobile must not simply be a smaller desktop.

Adapt:

* grid
* typography
* spacing
* navigation
* button layout
* image sizes
* section order

Hero:

Desktop:

```text
two-column
```

Mobile:

```text
single-column
```

Navigation:

Desktop:

```text
full navigation
```

Mobile:

```text
compact navigation
menu trigger
```

---

# 37. MOBILE RULES

On mobile:

```text
Page padding: 20px
Section spacing: 64–88px
Buttons: minimum 44px height
Body: 16px
```

Do not create tiny touch targets.

Minimum recommended interactive target:

```text
44 × 44px
```

Avoid horizontal overflow.

---

# 38. ACCESSIBILITY

Every component must consider:

* semantic HTML
* keyboard navigation
* focus states
* screen readers
* color contrast
* reduced motion
* touch targets
* alt text

Do not use color as the only state indicator.

Example:

Bad:

```text
red = error
```

Better:

```text
red + icon + text
```

---

# 39. CONTENT DESIGN

Copy should be:

* specific
* concise
* human
* confident
* useful

Avoid marketing clichés.

Do not repeatedly use:

```text
seamless
powerful
revolutionary
next-generation
innovative
game-changing
unlock
transform
supercharge
```

Prefer concrete language.

Instead of:

```text
A powerful platform that transforms your workflow.
```

Use:

```text
Plan, review, and ship releases from one workspace.
```

---

# 40. VISUAL HIERARCHY

Every section must have:

```text
1 primary element
1 supporting element
optional secondary elements
```

Do not make everything visually important.

Hierarchy:

```text
Primary
↓
Secondary
↓
Supporting
↓
Metadata
```

If everything is bold, nothing is important.

---

# 41. AI-GENERATED DESIGN AVOIDANCE

The following patterns are explicitly discouraged:

## Avoid excessive gradient

```text
purple → pink
blue → purple
orange → pink
```

## Avoid excessive glass

```text
backdrop-filter
blur
transparent cards
```

## Avoid floating 3D blobs

```text
abstract orb
AI brain
3D gradient object
```

## Avoid excessive pills

Do not turn:

```text
buttons
cards
tabs
inputs
badges
navigation
```

into pill shapes simultaneously.

## Avoid repetitive cards

Do not use:

```text
3 cards
3 cards
3 cards
```

throughout the entire page.

## Avoid generic AI copy

Do not use:

```text
Unlock the future.
Empower your journey.
Revolutionize your workflow.
```

## Avoid unnecessary decoration

Every visual element should have a reason.

---

# 42. PREMIUM DESIGN RULE

Premium does not mean:

```text
more effects
more gradients
more shadows
more animation
more 3D
```

Premium means:

```text
better spacing
better typography
better hierarchy
better consistency
better imagery
better motion
better details
```

---

# 43. DESIGN SIGNATURE

Every project should have 1–2 recognizable visual signatures.

Possible signatures:

```text
Editorial numbering
Large typography
Asymmetric grid
Distinctive accent color
Unique image cropping
Custom interaction
Strong whitespace
```

Do not use all of them.

Choose the combination that fits the product.

---

# 44. SECTION TRANSITIONS

Do not make every section start abruptly.

Use subtle transitions:

```text
background shift
border line
large whitespace
image overlap
typographic transition
```

Example:

```text
#F7F7F5
       ↓
#FFFFFF
       ↓
#F7F7F5
```

Avoid excessive waves and blobs.

---

# 45. FOOTER

Footer should be simple.

Structure:

```text
LOGO

Short product statement.

Product
Company
Resources
Legal

Social links

© 2026 Company
```

Do not make the footer visually louder than the main content.

---

# 46. PERFORMANCE

Animation must never compromise performance.

Prefer:

```text
transform
opacity
```

Avoid animating:

```text
width
height
top
left
margin
box-shadow continuously
```

Use GPU-friendly properties where possible.

Images should be:

* optimized
* responsive
* lazy-loaded when appropriate
* properly sized

Avoid huge unoptimized images.

---

# 47. REACT COMPONENT RULES

Components should remain focused.

Good:

```tsx
<Navbar />

<Hero />

<FeatureSection />

<MetricsSection />

<TestimonialSection />

<CTA />

<Footer />
```

Bad:

```tsx
<App>
  // 2000 lines of JSX
</App>
```

Create reusable primitives:

```text
Button
Container
Section
Heading
Text
Badge
IconButton
Input
Card
Modal
Tooltip
Toast
```

---

# 48. COMPONENT API

Components should support variants.

Example:

```tsx
<Button variant="primary">
  Get started
</Button>

<Button variant="secondary">
  Learn more
</Button>

<Button variant="ghost">
  Documentation
</Button>
```

Avoid creating separate components for every tiny visual variation.

---

# 49. DESIGN TOKENS

Centralize tokens.

Example:

```css
:root {
  --color-background: #F7F7F5;
  --color-surface: #FFFFFF;
  --color-foreground: #111111;
  --color-muted: #666666;
  --color-border: #E5E5E1;
  --color-accent: #2457FF;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --space-9: 80px;
  --space-10: 96px;
}
```

Do not hardcode random values throughout the application.

---

# 50. PAGE COMPOSITION RULE

A polished page should follow:

```text
NAVIGATION
     ↓
HERO
     ↓
PROOF
     ↓
STATEMENT
     ↓
FEATURE
     ↓
DETAIL
     ↓
VISUAL
     ↓
SOCIAL PROOF
     ↓
FAQ
     ↓
CTA
     ↓
FOOTER
```

But this is a guideline, not a mandatory template.

The page should adapt to the actual content.

---

# 51. MOTION HIERARCHY

Use three levels.

## Level 1 — Micro

```text
hover
focus
press
toggle
```

Duration:

```text
120–200ms
```

## Level 2 — Component

```text
dropdown
modal
toast
accordion
```

Duration:

```text
200–350ms
```

## Level 3 — Section

```text
scroll reveal
hero entrance
large visual
```

Duration:

```text
400–700ms
```

Never animate everything at the same intensity.

---

# 52. MOTION CONSISTENCY

All animations must feel like they belong to the same system.

Use consistent:

```text
duration
easing
distance
opacity
scale
```

Recommended reveal:

```text
opacity: 0 → 1
y: 16 → 0
```

Recommended hover:

```text
y: 0 → -2
```

Recommended press:

```text
scale: 1 → 0.98
```

---

# 53. DO NOT OVER-ANIMATE

Never do:

```text
every word animates
every icon rotates
every card floats
every section parallax
cursor has a trail
background constantly moves
```

The result should feel:

```text
smooth
quiet
responsive
expensive
```

not:

```text
busy
flashy
gimmicky
```

---

# 54. QUALITY CHECKLIST

Before shipping a page, verify:

## Visual

* [ ] Light background
* [ ] Neutral palette
* [ ] One primary accent
* [ ] Strong typography
* [ ] Consistent spacing
* [ ] Consistent radius
* [ ] Subtle borders
* [ ] Minimal shadows
* [ ] No unnecessary gradients
* [ ] No excessive glass
* [ ] No generic 3D blobs

## Layout

* [ ] Proper 12-column desktop grid
* [ ] Responsive tablet layout
* [ ] Responsive mobile layout
* [ ] Strong alignment
* [ ] Intentional whitespace
* [ ] No accidental overflow
* [ ] Sections have visual rhythm

## Components

* [ ] Buttons are consistent
* [ ] Inputs are consistent
* [ ] Icons use one library
* [ ] Cards are not overused
* [ ] States are defined
* [ ] Hover states exist
* [ ] Focus states exist
* [ ] Loading states exist
* [ ] Error states exist
* [ ] Empty states exist

## Animation

* [ ] Motion feels smooth
* [ ] Animations are subtle
* [ ] No excessive parallax
* [ ] No scroll hijacking
* [ ] No unnecessary animation
* [ ] Reduced-motion support exists
* [ ] Transform/opacity preferred

## UX

* [ ] Navigation is obvious
* [ ] Primary CTA is clear
* [ ] Text is readable
* [ ] Touch targets are large enough
* [ ] Keyboard navigation works
* [ ] Contrast is sufficient
* [ ] Errors are actionable

## AI-avoidance

* [ ] No generic AI copy
* [ ] No excessive gradients
* [ ] No excessive rounded cards
* [ ] No repetitive 3-card layouts
* [ ] No random decorative blobs
* [ ] No unnecessary glassmorphism
* [ ] No excessive glowing effects
* [ ] No excessive animations
* [ ] Layout feels intentionally art-directed

---

# 55. FINAL DESIGN STANDARD

The final website should communicate:

> **Clarity over decoration.**
>
> **Typography over effects.**
>
> **Composition over templates.**
>
> **Motion over gimmicks.**
>
> **Consistency over randomness.**

The website should look like it was designed by a senior product designer and implemented by an experienced React engineer.

When a design decision is uncertain, prefer the option that is:

1. simpler
2. clearer
3. more consistent
4. more accessible
5. faster
6. more intentional

The final visual target is:

```text
LIGHT
CLEAN
EDITORIAL
PRECISE
PREMIUM
SMOOTH
HUMAN
MODERN
```

and explicitly NOT:

```text
GENERIC AI SAAS
DARK MODE
NEON
GLASSMORPHISM
GRADIENT HEAVY
CARD HEAVY
OVER-ANIMATED
TEMPLATE-LIKE
```

---

# 56. IMPLEMENTATION PRINCIPLE

Do not blindly follow this document when it produces a worse user experience.

Design rules are constraints, not substitutes for judgment.

Content, information architecture, accessibility and usability always take priority over decoration.

Every component should answer:

```text
Why does this exist?
Why does it look this way?
Why does it move this way?
Why is it positioned here?
```

If there is no good answer, simplify it.
