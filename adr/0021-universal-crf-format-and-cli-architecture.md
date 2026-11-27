# ADR 0021: Universal Clinical Research Form (CRF) Specification, Guided CLI/TUI Workflow Engine, and Studio Interface Architecture

## Status

Accepted

## Context

Clinical Research Form (CRF) design workflows in clinical trials and medical device development suffer from severe tooling fragmentation. Clinical Data Managers (CDMs) and Biostatisticians frequently oscillate between clunky graphical interfaces and disconnected specification formats (CDISC ODM-XML, SAS programs, R scripts, FHIR Questionnaires, PDF/Word documents).

Furthermore, the existing CRF Studio web user interface encountered responsiveness and layout collisions:

1. **Header Congestion**: On certain viewport widths, the top bar collided with study-level selectors, action buttons, and the 6 primary studio mode tabs.
2. **Micro-Toolbar Clutter**: Canvas field cards displayed crowded column width buttons directly in the card header, degrading focus during visual form design.
3. **Missing Terminal & Automation Synergy**: Engineers and data managers lacked a lightweight, scriptable, zero-dependency CLI and interactive TUI wizard to scaffold studies, lint compliance, and execute atomic modifications from the terminal or an embedded console.

## Decision

We establish a unified, 4-tier architectural solution bridging declarative schemas, terminal-driven workflows, and a decluttered web studio:

### 1. Canonical Universal CRF Specification (`.crf.json` / `.crf.yaml`)

- Implemented a canonical schema using strict runtime Zod contracts (`lib/crf/universal-schema.ts`), validating `studyProtocol`, `forms`, `fields`, `visits`, `codelists`, `rules`, and `branding`.
- Guaranteed 100% lossless bidirectional compilation across:
  - CDISC ODM-XML 1.3.2
  - HL7 FHIR R4/R5 SDC Questionnaires
  - SAS Program Scaffolding (`PROC FORMAT` / `DATA` steps)
  - R tidyverse tibbles (`haven` labelled vectors)
  - Blank and Annotated aCRF Word (`.docx`) and PDF (`.pdf`)
- Integrated semantic diffing (`diffUniversalCrfStudies`) for version comparison and automated CLI command generation (`generateCliCommandForField`, `generateCliCommandForForm`).

### 2. Document-Driven CLI & Interactive TUI Guided Workflow (`crf` / `scripts/crf.ts`)

- Created a pure, decoupled execution engine (`lib/crf/cli-engine.ts`) supporting:
  - `crf info [file]`: Protocol telemetry and summary tables.
  - `crf validate [file]`: 4-tier CDASH, AST logic, and regulatory validation checks.
  - `crf add form <domain> [name]`: Instant CDASH domain scaffolding.
  - `crf add field <form> --var <VAR> --type <type>`: Atomic field addition.
  - `crf export --format <universal|odm|sas|r|fhir|sdtm_spec>`: Multi-format compilation.
  - `crf diff <studyA> <studyB>`: Semantic change analysis.
  - `crf wizard` / `crf init`: Interactive readline TUI guided authoring wizard.
- Implemented the 8 Document-Driven CLI design principles with ANSI visual formatting, machine-readable `--json` output, and `--dry-run` safety rails.
- Registered `crf` in `package.json` and delegated through `scripts/dx.ts` (`npm run dx crf`).

### 3. Studio Interface Overhaul & 2-Tier Resilient Header

- **2-Tier Resilient Header (`StudioHeader.tsx`)**:
  - **Tier 1 (Utility & Protocol)**: Study selector, CDISC compliance diagnostics badge, Undo/Redo, Theme toggle, `+ CDASH Form`, Document Export, and mobile overflow menu.
  - **Tier 2 (Navigation & Workspace)**: 6 segmented mode tabs (`Form Designer`, `Visit Matrix`, `Logic & AST Rules`, `Live 21 CFR EDC`, `Annotated aCRF`, `CDISC Exports`) with keyboard badges (`1`-`6`), in-studio terminal drawer toggle (`⌘J`), and sidebar visibility triggers.
- **Decluttered Field Card Ergonomics (`FieldRenderer.tsx`)**: Replaced noisy multi-button column selectors with a compact width stepper (`-` / `+`) that appears progressively on hover/focus.
- **1-Click CLI Inspection (`InspectorPanel.tsx`)**: Added a 1-click "Copy CLI Command" button in the Inspector header to copy executable CLI commands for any active field or form.

### 4. In-Studio Interactive Terminal Console (`StudioTerminal.tsx`)

- Integrated an embedded console drawer (`⌘J` or `` ` ``) with live bidirectional synchronization.
- Executing mutating commands inside the terminal immediately updates the active visual canvas state without page refresh.

## Consequences

- **Positive**:
  - Unifies clinical metadata into a version-controllable, human-readable specification.
  - Gives clinical teams both graphical and command-line interfaces that stay in lockstep.
  - Eliminates UI collisions across desktop, laptop, tablet, and mobile viewports.
  - Fully tested with 211 passing tests across 35 test suites.
- **Negative**:
  - Requires maintaining serializer parity when new CDASH domains or AST rule operators are introduced.
