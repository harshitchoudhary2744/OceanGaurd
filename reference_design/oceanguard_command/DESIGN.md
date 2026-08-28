---
name: OceanGuard Command
colors:
  surface: '#0f131d'
  surface-dim: '#0f131d'
  surface-bright: '#353944'
  surface-container-lowest: '#0a0e18'
  surface-container-low: '#171b26'
  surface-container: '#1c1f2a'
  surface-container-high: '#262a35'
  surface-container-highest: '#313540'
  on-surface: '#dfe2f1'
  on-surface-variant: '#bac9cc'
  inverse-surface: '#dfe2f1'
  inverse-on-surface: '#2c303b'
  outline: '#849396'
  outline-variant: '#3b494c'
  surface-tint: '#00daf3'
  primary: '#c3f5ff'
  on-primary: '#00363d'
  primary-container: '#00e5ff'
  on-primary-container: '#00626e'
  inverse-primary: '#006875'
  secondary: '#ffb4aa'
  on-secondary: '#690003'
  secondary-container: '#c5020b'
  on-secondary-container: '#ffd2cc'
  tertiary: '#ffebba'
  on-tertiary: '#3d2f00'
  tertiary-container: '#fdca00'
  on-tertiary-container: '#6d5600'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#9cf0ff'
  primary-fixed-dim: '#00daf3'
  on-primary-fixed: '#001f24'
  on-primary-fixed-variant: '#004f58'
  secondary-fixed: '#ffdad5'
  secondary-fixed-dim: '#ffb4aa'
  on-secondary-fixed: '#410001'
  on-secondary-fixed-variant: '#930005'
  tertiary-fixed: '#ffe08b'
  tertiary-fixed-dim: '#f1c100'
  on-tertiary-fixed: '#241a00'
  on-tertiary-fixed-variant: '#584400'
  background: '#0f131d'
  on-background: '#dfe2f1'
  surface-variant: '#313540'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  telemetry-lg:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
    letterSpacing: 0.05em
  telemetry-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  panel-padding: 20px
---

## Brand & Style

The design system is engineered for mission-critical maritime defense. The personality is authoritative, technical, and high-precision. It is designed for operators who require split-second decision-making capabilities in low-light command center environments.

The visual style utilizes **Tactical Glassmorphism**. This approach combines deep "Abyssal" backgrounds with semi-transparent, high-tech overlays that simulate head-up displays (HUDs). The aesthetic is grounded in high-contrast functionalism, ensuring that critical data points—such as spill coordinates and vessel telemetry—pierce through the dark interface with neon clarity. Every element must feel like a precision instrument: sharp, responsive, and indestructible.

## Colors

The palette is optimized for dark-mode environments to reduce eye strain during long-watch shifts.

- **Abyssal Navy (#0B0F19)**: The foundational void. Used for the lowest level of the UI.
- **Neon Cyan (#00E5FF)**: The primary action color. It represents active scanning, "Safe" statuses, and interactive tactical elements. It should feel "energized" through subtle outer glows.
- **Crimson Red (#FF3B30)**: Reserved exclusively for oil spill detection and critical system failures. It must maintain high contrast against all surface levels.
- **Amber (#FFCC00)**: Used for cautionary telemetry and weather warnings.
- **Glass Surfaces**: Use `#1F2937` with varying opacities (60%–80%) to allow background map textures to subtly bleed through, maintaining spatial awareness.

## Typography

Typography in this design system is divided into two distinct functional roles:

1.  **Command & Control (Inter)**: Used for general UI navigation, headers, and descriptive text. It provides maximum legibility and a professional, modern tone.
2.  **Tactical Data (JetBrains Mono)**: Used for all coordinates, timestamps, chemical signatures, and sensor readings. The monospaced nature ensures that fluctuating numerical data doesn't cause layout "jitter" and remains perfectly aligned in data grids.

Use `label-caps` for table headers and section titles to evoke a military-spec documentation style.

## Layout & Spacing

This design system utilizes a **Fixed Sidebar / Fluid Viewport** model. The primary "Tactical Map" occupies the base layer (Layer 0), while control panels and data readouts sit on Layer 1 as floating or docked glass modules.

- **Grid**: A 12-column grid is used for dashboard layouts, but telemetry overlays often use a 4px baseline shift for dense data packing.
- **Density**: High. Information density is prioritized over whitespace to ensure operators have all critical data within a single field of view.
- **Breakpoints**: 
    - **Desktop (1440px+)**: Full multi-panel view with permanent sidebars.
    - **Tablet (768px - 1439px)**: Collapsible sidebars, focused single-panel telemetry.
    - **Mobile**: Not recommended for primary command; restricted to "Alert Only" views with simplified status cards.

## Elevation & Depth

Depth is communicated through **Optical Layering** rather than traditional drop shadows:

- **Level 0 (Base)**: The global map or satellite feed.
- **Level 1 (Panels)**: Surface color `#1F2937` at 70% opacity with a 12px `backdrop-filter: blur()`. Borders are 1px solid `#374151`.
- **Level 2 (Modals/Active Alerts)**: Surface color `#1F2937` at 95% opacity. These feature a 2px "Glow Border" using the Primary Accent (Cyan) or Hazard Accent (Red) to indicate priority.

Instead of soft shadows, use "Inner Glows" (0px blur, 1px spread) on buttons and active indicators to simulate illuminated hardware.

## Shapes

The shape language is **Precision-Geometric**. We use "Soft" (4px) corner radii for most containers to prevent the UI from feeling "sharp" or "hostile," while maintaining a disciplined, technical appearance.

- **Buttons & Inputs**: 4px border radius.
- **Status Indicators**: Circular (Full Round) for "live" pulses; rectangular for static data tags.
- **Data Tables**: Square edges to emphasize the grid-like, mathematical nature of the data.

## Components

- **Tactical Buttons**: High-contrast fills using Primary Cyan for actions. Ghost variants use the `#374151` border with Cyan text. On hover, apply a `box-shadow: 0 0 12px #00E5FF33`.
- **Telemetry Chips**: Small, monospaced data tags with a subtle background tint (e.g., Red background at 10% opacity for "Spill Detected").
- **Glass Cards**: Content containers must feature a 1px top-highlight (a lighter border on the top edge than the bottom) to simulate light hitting a glass edge.
- **Glowing Status Indicators**: A small 8px circle with a `pulse` animation. 
    - Green/Cyan: System Nominal.
    - Pulsing Red: Active Leak Detected.
- **Input Fields**: Dark backgrounds (`#0B0F19`) with a 1px border. The border glows Primary Cyan when focused.
- **Tactical Icons**: Line-based icons with a 1.5pt stroke weight. Avoid filled icons to maintain the "HUD" transparency feel.