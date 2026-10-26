# ADR 0022: Next-Generation Clinical Case Report Form (CRF) Designer Architecture

## Status
Accepted

## Context
Legacy Electronic Data Capture (EDC) and CRF authoring suites (Medidata Rave Architect, Oracle InForm, REDCap) rely on fragmented 1990s tabbed navigation, manual pseudo-code rule editors, and slow deploy-test lifecycles. Users are forced to design forms in one tab, write edit checks in another, and deploy dummy test environments just to test whether a validation rule triggers on invalid inputs.

To establish the ultimate clinical trial authoring experience, we modernize CRF Studio with the fluidity and keyboard-driven ergonomics of tools like Notion, Figma, and Linear, while retaining strict 21 CFR Part 11, CDASH 2.2, and CDISC compliance.

## Decision
We introduce a comprehensive 7-pillar architectural overhaul across the CRF Studio application:

### 1. Context-Aware Tri-Pane Workspace
- **Left Pane (Study Spine & Global Library)**: Unified longitudinal study timeline (Screening ➔ Baseline ➔ Treatment Cycles ➔ Follow-up) paired with a drag-and-drop Global Library of standardized forms and clinical smart blocks.
- **Center Pane (WYSIWYG Canvas & Bi-Directional Grid)**: Dual-mode interactive canvas supporting visual WYSIWYG form design and high-density spreadsheet grid mode with sub-millisecond bidirectional state synchronization.
- **Right Pane (Dynamic Fluid Inspector)**: Context-sensitive inspector panel dynamically switching between Form Health settings, Field Properties, Natural Language Logic (NLL) edit checks, CDISC/NCI metadata, and 21 CFR Part 11 Field Comments.

### 2. In-Canvas Slash Commands (`/`) & Clinical Smart Blocks
- Integrated Notion-style in-canvas `/` command palette for rapid keyboard-driven widget insertion (`/date`, `/radio`, `/calc`, `/table`, `/nrs`).
- Introduced compound Clinical Smart Blocks (`/vitals`, `/recist`, `/conmeds`, `/lab-panel`, `/ae`, `/demographics`) that drop in pre-validated CDASH variable bundles with standard NCI codelists, unit selectors, and pre-wired AST edit checks and calculations.

### 3. Dual-Paradigm No-Code Logic (Natural Language Logic & Visual Logic Wires)
- **Natural Language Logic (NLL)**: Visual sentence-based conditional rule builder in the Inspector (`[IF] [Systolic BP] [>] [180] ➔ [RAISE QUERY] ["Hypertensive crisis warning"]`) that compiles directly to safe AST `EditCheckRule` schemas.
- **Visual Logic Wires (Figma-Style)**: Interactive canvas mode rendering SVG bezier connection wires from trigger fields to dependent target sections and fields with drag-to-connect interactions.

### 4. Bi-Directional Grid View (Spreadsheet Mode) & Dependency Web Sentinel
- **Bi-Directional Grid View**: High-density Excel-like spreadsheet mode allowing biostatisticians and CDMs to bulk-edit variable names (OIDs), labels, data types, and core requirements with instant reflection on the visual canvas.
- **Dependency Web Sentinel**: Blast-radius interception engine preventing accidental variable deletion or renaming by analyzing referencing rules, calculations, cross-visit dependencies, and SoA matrices, offering 1-click clean refactoring.

### 5. In-Builder Live Simulator (Split-Screen Testing)
- Dockable 50/50 split-screen testbed docked alongside the WYSIWYG canvas on simulated mobile/tablet viewports.
- Real-time reactive execution of AST formulas and validation edit checks on keystroke against simulated subject data without leaving the designer.

### 6. Multiplayer Collaboration, 21 CFR Part 11 Field Comments & Time-Machine Diffs
- **Field-Level Commenting**: Threaded review comments linked to specific field OIDs, supporting role attribution (Medical Monitor, Data Manager, Biostatistician) and resolved status logging into the immutable audit trail.
- **Collaborative Presence**: Simulated live peer cursors and real-time collaborator badges.
- **Time-Machine Visual Diffs**: Interactive protocol revision slider rendering green addition highlights, red strikethroughs for deletions, and amber diffs for modified field attributes.

### 7. Clinical Omnibar (`Cmd+K` / `Ctrl+K`)
- In-studio quick-action search bar over the canvas providing instant access to master dictionary lookups (MedDRA, WHODrug), domain scaffolding, rule synthesis, and navigation without modal context-switching.

## Consequences
- **Positive**:
  - Eliminates 90% of tab-switching and manual pseudo-code syntax errors in clinical study build workflows.
  - Decreases trial setup and validation time from hours to minutes.
  - Seamlessly maintains 100% lossless export parity with CDISC ODM-XML 1.3.2, HL7 FHIR SDC, SAS, R, and aCRF documents.
- **Negative**:
  - Requires maintaining bi-directional synchronization across Canvas, Grid, Wire, and Simulator states.

## Amendment 2026-10-26: what was built

A review of CRF Studio against this record ([#2927](https://github.com/fderuiter/deruiter.dev/issues/2927)) found that some of the decision above describes intent rather than the studio as it exists. This amendment records the difference, in the spirit of [#2712](https://github.com/fderuiter/deruiter.dev/issues/2712), which made the site's copy describe implemented checks instead of compliance claims. The original text above is left as written.

- **Built as described:** the three-pane workspace, slash commands and smart blocks, the sentence rule builder and visual logic wires, the bi-directional grid, the deletion blast-radius preview, the test dock, field-level review threads, and baseline diffs.
- **Collaborative presence was not built.** There are no peer cursors or collaborator badges, simulated or otherwise. Review threads carry role attribution only.
- **The omnibar is Find, not `Ctrl+K`.** `Ctrl+K` opens the site search, so the studio's omnibar uses `F` (#1208). It finds forms, fields, visits and actions. It offers no MedDRA or WHODrug lookups and says so, because those dictionaries are licensed.
- **21 CFR Part 11 is a modelled workflow, not a compliance claim.** CRF Studio is not a validated system; the page's notice and FAQ say so.
- **The consequences above are not measured.** The figures for tab-switching and setup time are not backed by any study, and export fidelity is checked by per-format tests rather than claimed as lossless.
