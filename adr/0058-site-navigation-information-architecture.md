# ADR 0058: Site Navigation Information Architecture

## Status

Accepted on 2026-10-05, under the epic
[#1842](https://github.com/fderuiter/deruiter.dev/issues/1842), phase N1
([#1843](https://github.com/fderuiter/deruiter.dev/issues/1843) to
[#1846](https://github.com/fderuiter/deruiter.dev/issues/1846) and
[#1841](https://github.com/fderuiter/deruiter.dev/issues/1841)). Later phases
(a single Preferences menu, and parity for the palette, sitemap, breadcrumbs and
previous/next chains) build on it.

## Context

The top bar had nine competing controls. Arcade held twelve entries, mixing
games with a shop page and a workbench. Systems mixed simulators, studios, a
case study and two site pages. The mobile drawer, the footer and the command
palette each kept their own list, so the same page carried different names and
headings on different surfaces and new pages were added in one place and
forgotten in another.

## Decision

Navigation is data in `lib/navigation.ts`. It holds the groups, their menu
sections and items, the paths that mark a group as current, the phone-sized
variant of a page where one exists, and the reading mode that hides an item. It
contains no JSX: items name an icon by key and `components/nav/NavIcon.tsx`
draws it.

The top bar has six items.

| Item       | Kind | Contents                                                                                                                |
| ---------- | ---- | ----------------------------------------------------------------------------------------------------------------------- |
| Work       | link | Case studies, including Designing for My Brother                                                                        |
| Blog       | link |                                                                                                                         |
| Arcade     | menu | The hub and games only                                                                                                  |
| Simulators | menu | Simulators (Protocol Drift, Incident Simulator, Patrol Shift), Studios (CRF Studio, Proof Workspace, NeuroRecon Studio) |
| About      | menu | About Fred, Under the Hood, Open Source Credits, Office Hours, GitHub                                                   |
| Contact    | link |                                                                                                                         |

- Merch is reached from Laser Loon and the footer, not from the Arcade menu.
- Protocol Drift is a workbench, so it lives at `/protocol-drift` and redirects
  from its old arcade URL ([ADR 0056](0056-protocol-drift-architecture.md),
  amended).
- The desktop menus are disclosure panels of links. The arrow keys, Home and End
  move between links, Escape closes the panel and returns focus to its trigger,
  and hover and click both work.
- The mobile drawer reads the same groups. Arcade, Simulators and About fold,
  the section holding the current page starts open, folded links stay in the
  document under `hidden`, and rows are at least 48px tall.
- The footer's Arcade, Simulators and Site columns read the same data.
- The command palette keeps its richer entries. `__tests__/navigation.test.ts`
  fails if a navigation href has no palette entry, and if a first-class route in
  `lib/public-routes.ts` is in no group.

## Consequences

- Adding a page to the navigation is one entry in `lib/navigation.ts`; the bar,
  drawer and footer follow. The palette, sitemap, metadata, social image and
  page-bench route still need their own entries (the five-point discovery
  matrix in `AGENTS.md`), and the test above catches a missing palette entry.
- The Simulators label has no overview page of its own. Its trigger opens the
  menu, and a Simulators index is a possible later addition.
- Breadcrumbs on the existing studios said "Systems"; phase N3 (amendment below)
  replaced that with the menu group's name.

## Amendment 2026-10-09: one Preferences menu

Phase N2 ([#1847](https://github.com/fderuiter/deruiter.dev/issues/1847)). The
STORY/PRO toggle, the "Aa" dyslexia pill, the sound panel and the tablet
Preferences panel are replaced by one Preferences menu in the top bar,
`components/nav/PreferencesMenu.tsx`.

- The panel has three labelled sections: Reading mode, Sound and Text. The
  mobile drawer renders the same `PreferencesPanel`, so a preference behaves the
  same on both surfaces.
- Nothing about storage changed. Reading mode still persists under the persona
  key, the font under `portfolio-font-mode`, and sound under `sound_muted`,
  `sound_volume` and `sound_profile`.
- Every change is announced to screen readers. Reading mode is assertive; sound
  and font changes are polite.
- The skip-link toggle, the footer toggle and the command palette command from
  [ADR 0040](0040-dyslexia-first-typography-and-dynamic-pretext-accessibility.md)
  are unchanged.

## Amendment 2026-10-09: parity across the other surfaces

Phase N3 ([#1848](https://github.com/fderuiter/deruiter.dev/issues/1848),
[#1849](https://github.com/fderuiter/deruiter.dev/issues/1849)).

- Breadcrumbs: the parent crumb is the page's menu group (`getNavBreadcrumbParents`
  and `getNavBreadcrumbSchemaParents` in `lib/navigation.ts`), so "Systems" is
  gone. A group's own overview page and plain top-bar links get no parent.
- `llms.txt` has one section per top-bar item in bar order, then mobile and
  utility routes. Protocol Drift is listed with the Simulators.
- The command palette shows each entry's group before its badge.
- The sitemap rates the Simulators pages, `/stack` and `/work/laser-loon` at 0.9.
- `__tests__/e2e/navigation-matrix.spec.ts` covers the bar, the three menus, the
  drawer and Preferences at 320, 375, 768, 1024 and 1440 px, with a header
  overflow check at each width and at 200% text.

## Amendment 2026-10-26: Clinical, Labs, Arcade, Writing and About

[#2952](https://github.com/fderuiter/deruiter.dev/issues/2952), carrying
[#2927](https://github.com/fderuiter/deruiter.dev/issues/2927) item 1. Fred
chose this grouping on 2026-10-26. The inventory, the current and proposed
sitemaps and the mockups are in the project's
`plans/2026-10-26-site-navigation/` notes.

The clinical work grew after the original decision: CRF Studio, Protocol
Drift, the Study Data Pipeline and the Clinical Data Platform with its
dashboards were all filed under Simulators. That menu reached eleven items,
half of them dashboards rather than simulators. Its href was `/simulator`, so
the "Simulators" breadcrumb on every clinical page led to the Incident
Simulator.

The top bar keeps six items.

| Item     | Kind | Contents                                                                                                                                       |
| -------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Clinical | menu | The journey in order (CRF Studio, Protocol Drift, Study Data Pipeline, Clinical Data Platform), then Platform tools; overview page `/clinical` |
| Labs     | menu | Proof Workspace, NeuroRecon Studio, Incident Simulator, Patrol Shift; overview page `/labs`                                                    |
| Arcade   | menu | The hub, then Clinical life, Fred's life, and Puzzles and classics                                                                             |
| Writing  | menu | Blog, Case Studies, and the featured Laser Loon design study and Designing for My Brother                                                      |
| About    | menu | About Fred, Office Hours, Under the Hood, Open Source Credits, Our Wedding, Laser Loon Merch, GitHub                                           |
| Contact  | link |                                                                                                                                                |

- The Clinical menu builds its journey entries from `CLINICAL_JOURNEY` in
  `lib/clinical-journey.ts`, so the menu, the journey strip on each step and
  the `/clinical` overview cannot list the steps in different orders. The
  case-study step is reached from Writing.
- A group can name an overview page (`overviewLabel`), shown at the foot of
  its menu and its drawer section. Writing has none: its href is the blog and
  it sets `noBreadcrumb`, so case studies and posts get no "Writing" parent.
- The footer has one column per menu, in bar order. The "Site" column and
  `FOOTER_EXTRA_ITEMS` are gone; Merch and Our Wedding moved into About, and
  `/work/laser-loon` is in the navigation for the first time.
- Journey entries carry their step number, shown before the title in the
  menu and the drawer.
- No URLs changed.
- Breadcrumb trails come from the navigation (#2952 N3).
  `getBreadcrumbTrail(path)` gives Home, the group's overview, the index page
  the path extends (Clinical Data Platform for `/platform/sql`, Blog for a
  post), then the page under its menu name. `Breadcrumbs` takes a `path`, and
  `getBreadcrumbTrailSchema` feeds the JSON-LD, so the visible trail and the
  structured data cannot disagree. Every public page but Home and the offline
  fallback now shows one trail. The
  Operations dashboard's drill-down path is labelled "Dashboard level", so
  each page has a single Breadcrumb landmark.
