# ADR 0040: Dyslexia-First Typography Stack & Dynamic Pretext Cognitive Accessibility

## Status

Accepted on 2026-09-13. Extends ADR 0005 (Continuous Accessibility Auditing Framework) and ADR 0011 (Bespoke Scientific & Engineering Editorial Design System).

## Context

Standard web typography frequently defaults to neo-grotesque sans-serifs (such as Inter, Helvetica, or Roboto) that prioritize geometric uniformity over character distinction. For readers with dyslexia and cognitive reading fatigue (including Frederick's brother), these uniform glyphs create acute perceptual friction:

1. **Character Ambiguity**: Mirrored letterforms (`b`/`d`, `p`/`q`), identical vertical stems (`I`, `l`, `1`), and circular glyphs (`0`, `O`) easily rotate or blur in mental processing.
2. **Visual Crowding**: Tight letter tracking and dense line spacing cause line-skipping and cognitive exhaustion.
3. **Aesthetic Alienation**: Portfolios and technical applications routinely sacrifice human readability for minimalist aesthetic tropes.

The portfolio requires a typographic foundation that reflects Frederick's core philosophy (building reliable, accessible systems for the people he loves first) without compromising high-assurance engineering rigor.

## Decision

We adopt a **Dyslexia-First Typography Architecture** structured into a dual-mode system:

### 1. Default Global Baseline: The Atkinson Hyperlegible + Lexend Hybrid

- **Headings & Display (`--font-heading`)**: **Lexend** (via `next/font/google`). Clinically researched by Dr. Bonnie Shaver-Troup to optimize reading fluency, character pacing, and visual acquisition in headlines and section anchors.
- **Body Prose & UI (`--font-sans`)**: **Atkinson Hyperlegible** (via `next/font/google`). Engineered by the Braille Institute to maximize character disambiguation through distinct glyph geometries (e.g. serifed uppercase `I`, curved lowercase `l`, slashed `0`, asymmetric `b`/`d`).
- **Code & AST Formal Methods (`--font-mono`)**: `Geist Mono` preserved for fixed-width tabular data, SAT solvers, and terminal alignment.

### 2. Dynamic Dyslexia Mode: 1-Click OpenDyslexic Switch

- A persistent, client-side accessibility state (`useFontPreference` / `A11yProvider`) allowing visitors to switch the entire site into **OpenDyslexic** (`OpenDyslexic3` and `OpenDyslexic Mono`).
- **Full Typesetting Geometry Shift**: When activated, the DOM not only swaps font faces, but dynamically expands line height (`1.75`), increases letter tracking (`+0.04em`), loosens word spacing, and constrains measure to `65ch`.

### 3. Userland Canvas Layout Calibration (`@chenglou/pretext`)

- Rather than suffering browser layout thrashing or cumulative layout shifts (CLS) when fonts and line-heights toggle, the `@chenglou/pretext` text layout engine dynamically measures OpenDyslexic and Atkinson/Lexend canvas font strings in userland.
- On font mode change, Pretext caches invalidate and recalculate container heights and multiline line wraps with zero visual jitter.

### 4. 4-Point Accessibility Discovery Matrix

The OpenDyslexic mode switch is accessible across 4 distinct surfaces:

1. **`<SkipToContent />`**: Mounted as the first keyboard tab-stop, enabling immediate font switching before navigating page content.
2. **Navbar**: The Text section of the Preferences menu in the desktop navigation bar and in the mobile drawer ([ADR 0058](0058-site-navigation-information-architecture.md), amended).
3. **Command Palette (`⌘K`)**: Searchable command `"Toggle Dyslexia Mode (OpenDyslexic)"`.
4. **Footer**: Persistent toggle switch in the site footer.

### 5. Personal & Family Narrative Anchor

Frederick's family journey with dyslexia and the motivation for building this site for his brother is documented in a dedicated case study (`/case-studies/designing-for-my-brother`) and anchored directly in the homepage hero narrative and toggle contextual popover.

## Consequences

- Universal, barrier-free cognitive accessibility for readers with dyslexia and low vision.
- Immediate disambiguation of critical technical symbols in clinical data and AST proofs.
- `@chenglou/pretext` maintains zero-CLS performance across font switching.
- Font assets for OpenDyslexic are self-hosted via `next/font/local` (`.woff2`) to avoid third-party CDN latency.
- Demonstrates deep empathy, domain intentionality, and commitment to family-centered engineering.
