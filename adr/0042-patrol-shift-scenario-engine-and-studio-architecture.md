# ADR 0042: Patrol Shift Scenario Engine & Studio Architecture

## Status

Accepted on 2026-09-15. Governs epic #744 and its child tickets (#745–#756). Establishes the architectural foundation for Patrol Shift (`/patrol`), a Midwest ski-patrol judgment and triage simulator.

## Context

The portfolio includes high-assurance domain tools such as CRF Studio (`/crf`), Logical Proof Workspace (`/proof`), and NeuroRecon Studio (`/neuro`). To showcase domain-driven simulation and Outdoor Emergency Transportation (OET) decision-making, Patrol Shift introduces an interactive ski patrol shift simulator.

Key design imperatives:

1. **Studio Standard**: Patrol Shift must follow `<PageLayout variant="studio">` (matching `/crf` and `/proof`), preserving zero-reflow layout, breadcrumbs, NextPrevNav, and global navbar/footer integration without secondary navbar duplication.
2. **Encapsulation & Boundary Hygiene**: Core simulation logic resides under `lib/patrol/`, where `index.ts`, `types.ts`, and `presets.ts` define public contracts while subfolder `lib/patrol/scenarios/` is strictly private and invisible to outside code. Enforced by `dependency-cruiser`.
3. **Domain Engine Design**: The domain engine comprises a Shift FSM (`engine.ts`), Outdoor Emergency Transportation scoring engine (`oet-engine.ts`), automated debrief evaluator (`debrief.ts`), dialogue state system (`dialogue.ts`), and event dispatcher (`events.ts`).

## Decision

### 1. Route & Studio Container Architecture

- **Route**: Mounted at `/patrol`.
- **Page Shell**: `app/patrol/page.tsx` dynamically imports `PatrolShiftContainer` with `PatrolShiftSkeleton` fallback.
- **Metadata & SEO**: `app/patrol/layout.tsx` consumes `ROUTE_METADATA_CONFIGS.patrol` and injects WebApplication and Breadcrumb JSON-LD schemas.
- **OpenGraph**: `app/patrol/opengraph-image.tsx` uses `createSocialImageResponse` with emergency response branding.

### 2. Deep Module Architecture (`lib/patrol`)

- **Public API**:
  - `lib/patrol/types.ts`: Domain models (`PatrolScenario`, `ShiftState`, `PatrolEvent`, `ScenarioAction`, `DebriefRule`).
  - `lib/patrol/presets.ts`: Exports `PATROL_SCENARIOS` catalog loaded from private scenarios.
  - `lib/patrol/engine.ts`: Pure FSM state transitions (`createInitialShiftState`, `reduceShiftState`, `createPatrolShiftEngine`).
  - `lib/patrol/oet-engine.ts`: OET protocol rule verification and score calculations.
  - `lib/patrol/debrief.ts`: Debrief report compilation.
  - `lib/patrol/dialogue.ts`: Triage and radio dialogue nodes.
  - `lib/patrol/events.ts`: Event factory and queue management.
  - `lib/patrol/index.ts`: Unified public re-export module.
- **Private Subfolder**:
  - `lib/patrol/scenarios/`: Encapsulated scenario definition files. Restricted from direct import outside `lib/patrol/`.

### 3. System Matrix Integration

Registered across all 5 discovery matrix touchpoints:

1. `CommandPalette.tsx`: `staticNavs` entry `nav-patrol-shift`.
2. `Navbar.tsx`: `SYSTEMS_ITEMS` entry, `isSystemsActive` route matching, and mobile drawer link.
3. `Footer.tsx`: Systems column entry `<Link href="/patrol">`.
4. SEO / Sitemap: `ROUTE_METADATA_CONFIGS.patrol`, `PUBLIC_ROUTE_REGISTRY` in `lib/public-routes.ts`, and `app/sitemap.ts`.
5. OpenGraph: `app/patrol/opengraph-image.tsx`.

## Consequences

- Clean separation between UI rendering (`components/patrol/`) and domain mechanics (`lib/patrol/`).
- Strict module encapsulation validated via `npm run lint:boundaries`.
- Seamless discoverability across navigation dropdowns, search palette, sitemap, and SEO tags.
