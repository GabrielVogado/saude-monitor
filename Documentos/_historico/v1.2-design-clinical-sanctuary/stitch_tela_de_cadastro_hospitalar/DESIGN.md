# Design System Strategy: Clinical Precision & Tonal Depth

## 1. Overview & Creative North Star
In the high-stakes environment of hospital management, design must transcend mere utility. This design system is guided by the Creative North Star: **"The Clinical Sanctuary."** 

This direction moves away from the rigid, "boxed-in" feeling of legacy healthcare software. Instead, we embrace a sophisticated, editorial approach that uses high-contrast typography, airy white space, and layered tonal surfaces to project an image of absolute security and institutional intelligence. We break the template by favoring intentional asymmetry and depth over standard 1px borders, creating a UI that feels less like a form and more like a high-end medical instrument.

## 2. Colors & Surface Logic
Our palette is rooted in a deep, authoritative blue and a calming secondary teal, supported by a sophisticated range of surface neutrals.

### The "No-Line" Rule
To achieve a premium feel, **1px solid borders are strictly prohibited for defining sections.** Separation of content must be achieved through:
- **Background Color Shifts:** Use `surface-container-low` for secondary sections sitting on a `surface` background.
- **Tonal Transitions:** Define areas using subtle value shifts rather than high-contrast outlines.

### Surface Hierarchy & Nesting
Think of the interface as stacked layers of fine medical paper or frosted glass.
- **Surface (Base):** Your foundational background (`#f7f9fb`).
- **Surface Container Lowest:** Use for primary input areas or focused cards to provide a "recessed" or "ultra-clean" feel.
- **Surface Container High/Highest:** Use for floating elements or elevated navigational states.

### The "Glass & Gradient" Rule
To inject "soul" into the institutional mood:
- **Glassmorphism:** For floating modals or navigation bars, use semi-transparent surface colors with a `backdrop-blur` (20px–40px). This maintains context while ensuring legibility.
- **Signature Textures:** Primary CTAs should not be flat. Use a subtle linear gradient from `primary` (#006193) to `primary_container` (#007bb8) at a 135-degree angle to provide a sense of tactile depth.

## 3. Typography
We employ a dual-typeface system to balance authority with accessibility.

*   **Display & Headlines (Manrope):** A modern sans-serif with a geometric foundation. Used for high-level data and welcome screens to convey institutional strength.
*   **Title & Body (Inter):** A hyper-legible workhorse. Inter’s tall x-height ensures clarity for complex medical terminology and patient data.

**Hierarchy Strategy:**
- **Display-LG/MD:** Reserved for critical data points (e.g., total bed occupancy).
- **Headline-SM:** Used for primary card titles and page headers.
- **Body-MD/LG:** The standard for all user input and patient notes.
- **Label-SM:** Used for micro-copy and metadata, always in `on_surface_variant` to reduce visual noise.

## 4. Elevation & Depth
Elevation is expressed through light and shadow, not lines.

*   **The Layering Principle:** Depth is achieved by stacking surface tokens. A `surface_container_lowest` card placed on a `surface_container_low` background creates a natural, soft lift.
*   **Ambient Shadows:** For high-priority floating elements, use a "Cloud Shadow": `Y: 8px, Blur: 24px, Color: on_surface (opacity: 6%)`. This mimics natural clinical lighting.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility in input fields, use `outline_variant` at 20% opacity. Never use 100% opaque borders.
*   **Glassmorphism:** Use for persistent elements like the bottom navigation to create a sense of lightness and technical sophistication.

## 5. Components

### Buttons
- **Primary:** Gradient-filled (`primary` to `primary_container`), `xl` (1.5rem) roundedness. Must include a trailing icon (e.g., `arrow_forward`) to indicate progression.
- **Secondary:** Transparent background with a "Ghost Border" and `primary` text.
- **Tertiary:** Text-only, using `label-md` in `primary` weight.

### Input Fields
- **Styling:** `surface_container_lowest` background, `xl` roundedness. 
- **Icons:** Leading icons are mandatory for primary login/search fields, styled in `outline`.
- **States:** On focus, the border transitions to a 2px `primary` stroke, but the background maintains its tonal depth.

### Cards & Lists
- **The "No-Divider" Rule:** Forbid the use of horizontal rules. Separate list items using `spacing-4` or `spacing-6` of vertical white space or a subtle background shift between `surface` and `surface_container_low`.

### Checkboxes & Radio Buttons
- **Checkboxes:** Soft `sm` rounding (0.25rem). When checked, use `secondary` (#006a6a) to provide a calming "success" cue rather than the aggressive primary blue.

### Additional App-Specific Components
- **Status Badges:** Use `secondary_container` with `on_secondary_container` text for "Active" states. Use `error_container` for "Urgent" alerts.
- **Data Pills:** Small, `full` rounded chips for displaying medical tags or department names, using `surface_variant`.

## 6. Do's and Don'ts

### Do
- **Do** use `spacing-8` and `spacing-10` to create "breathing room" around critical data.
- **Do** align icons perfectly with the cap-height of adjacent typography.
- **Do** use `tertiary` (#884e00) accents sparingly for cautionary warnings that aren't quite "errors."

### Don't
- **Don't** use pure black (#000000) for text. Use `on_surface` (#191c1e) to maintain a soft, professional contrast.
- **Don't** use standard 4px or 8px "box shadows" from CSS frameworks. They feel "cheap" and "templated."
- **Don't** overcrowd a single screen. If a management task is complex, use a progressive disclosure pattern (multi-step process).