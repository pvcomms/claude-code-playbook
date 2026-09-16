---
name: taste
description: Anti-slop frontend framework. Stops AI from generating boring, generic designs. Injects opinionated design rules replacing generic patterns with premium, intentional designs. Use alongside frontend-design for maximum effect.
---

# Taste Skill - Anti-Slop Frontend

Gives AI good taste. Stops generating boring, generic, "slop" frontends. Replaces generic patterns (3-column grids, gradient buttons, emoji headers) with premium, intentional designs.

## Core Philosophy

Premium, expensive-feeling UI with: premium fonts, generous whitespace, real depth, smooth spring animations. Framework-agnostic -- rules focus on design decisions, not framework-specific code.

## Three Adjustable Parameters

### Design Variance (Low / Medium / High)

Controls how far from conventional the design goes.

- **Low**: Clean, professional, safe choices
- **Medium**: Distinctive but approachable
- **High**: Bold, experimental, boundary-pushing

### Motion Intensity (Subtle / Balanced / Dramatic)

Controls animation presence.

- **Subtle**: Fade-ins, gentle transitions only
- **Balanced**: Staggered reveals, hover effects, scroll-triggered
- **Dramatic**: Complex choreographed sequences, parallax, physics-based

### Visual Density (Sparse / Balanced / Dense)

Controls information and element density.

- **Sparse**: Maximum whitespace, editorial feel
- **Balanced**: Comfortable reading density
- **Dense**: Data-rich, dashboard-like

## Banned Patterns (Anti-Slop Rules)

### Never Use These Fonts

Inter, Roboto, Arial, Open Sans, Helvetica, system-ui defaults

### Never Use These Layouts

- Generic 3-column feature grids
- Hero + 3 cards + CTA pattern
- Cookie-cutter SaaS landing pages
- Evenly-distributed pastel color schemes
- Purple/blue gradient backgrounds

### Never Use These Elements

- Emoji as UI icons
- Generic stock illustrations
- "AI-generated" looking gradient meshes without purpose
- Pill buttons with gradients
- Generic testimonial carousels

## What To Use Instead

### Typography

- Premium display fonts: Satoshi, Cabinet Grotesk, Clash Display, General Sans, Switzer
- Editorial serifs: Fraunces, Instrument Serif, Newsreader, Source Serif 4
- Monospace accents: JetBrains Mono, Berkeley Mono, Geist Mono
- Tight letter-spacing on headings (-0.02em to -0.04em)
- Generous line-height on body (1.6-1.75)

### Color Strategy

- Warm monochrome base (off-whites: #F7F6F3, #FAFAF8)
- Body text: off-black charcoal (#111111 or #2F3437), never pure black
- Ultra-light dividers (#EAEAEA)
- Single accent color used sparingly with purpose
- Desaturated, muted tones over bright primaries

### Spacing & Layout

- Macro-whitespace first: py-24 to py-32 between sections
- Content constrained: max-w-4xl to max-w-5xl
- Asymmetric compositions over centered everything
- Overlapping elements for depth
- Grid-breaking moments for visual interest
- 8px spacing rhythm throughout

### Motion

- Entry animations: translateY(12px) + opacity over 500-600ms
- Easing: cubic-bezier(0.16, 1, 0.3, 1) for natural deceleration
- Hover cards: from no shadow to 0 2px 8px rgba(0,0,0,0.04)
- Staggered list reveals with cascading delays
- Only animate transform and opacity -- never layout properties
- Spring physics over linear easing
- Exit faster than enter (60-70% duration)

### Components

- Cards: 1px solid #EAEAEA, 8-12px radius, generous padding (24-40px)
- Buttons: solid #111111 bg, minimal radius (4-6px), hover via scale(0.98)
- Tags: pill shapes, uppercase tracking, pastel backgrounds
- Borders: single pixel, light gray -- never heavy or dark
- Shadows: extremely subtle, almost imperceptible

### Icons & Imagery

- Phosphor or Radix UI icon sets
- Monochromatic line illustrations
- Desaturated, warm-toned photography
- Minimal geometric patterns at low opacity (0.03-0.04)

## Execution Checklist

1. Establish macro-whitespace between all sections
2. Constrain content width
3. Apply custom typography and color variables immediately
4. Add scroll-entry animations to major blocks
5. Ensure every surface has visual depth (subtle imagery or gradients)
6. Test both light and dark if applicable
7. Verify no banned patterns slipped in
