# Portfolio UI/UX improvement backlog

Prepared 2026-09-08. This initial 32-item inventory was consolidated into 24 approved and published GitHub tickets; see [the published ticket index](ui-ux-ticket-proposal.md). It covers the public portfolio, project pages, studios, arcade, and supporting contact/authentication experiences.

## Scope and evidence

- **Observed** means seen in the initial homepage preview or reported in this session. It does not establish a defect on every route.
- **Source-supported** identifies a concrete implementation concern; the associated visual impact still needs browser verification where stated.
- **Audit required / design proposal** means work to validate or improve, not a claim that the current feature is absent or broken.
- Earlier code changes remain uncommitted. Tickets marked “draft changes exist” require review and verification before being closed.
- No additional implementation is included in this planning pass.

## Priority and sizing

- **P1:** Core professional presentation, usability, accessibility, or reliability. Address before calling the polish complete.
- **P2:** Refinement that improves clarity, personality, or depth after the foundations work.
- **S / M / L:** Relative effort, not time estimates. Split L tickets into implementation slices after their audit.
- Use `needs-triage` while scope or design choices remain open. Use `ready-for-agent` only after dependencies and acceptance criteria are settled. No P0 outage is asserted by this backlog.

## Ticket index

| ID | Priority | Size | Ticket |
| --- | --- | --- | --- |
| UX-01 | P1 | M | Define the portfolio’s visual system and reference layouts |
| UX-02 | P1 | M | Create a route-by-route visual baseline |
| UX-03 | P1 | M | Improve text hierarchy and contrast throughout the site |
| UX-04 | P1 | M | Eliminate overflow and collisions across shared layout primitives |
| UX-05 | P1 | S | Resolve hero crowding and establish a clear first impression |
| UX-06 | P1 | M | Make the engineering demo responsive and keyboard accessible |
| UX-07 | P1 | M | Stabilize hero text rendering and selection |
| UX-08 | P2 | M | Improve homepage pacing and reduce unnecessary scrolling |
| UX-09 | P1 | M | Curate featured projects around evidence and outcomes |
| UX-10 | P2 | M | Make project snippets readable and visually consistent |
| UX-11 | P1 | M | Simplify global navigation and clarify destination names |
| UX-12 | P1 | M | Verify mobile navigation and desktop menu interaction |
| UX-13 | P2 | M | Explain persona switching and preserve visitor orientation |
| UX-14 | P1 | M | Polish search and command-palette discovery |
| UX-15 | P1 | M | Make the case-study index easy to scan and explore |
| UX-16 | P1 | L | Standardize case studies around problem, decisions, and results |
| UX-17 | P2 | M | Improve experience and skills storytelling |
| UX-18 | P1 | M | Create a clear contact journey with fewer competing actions |
| UX-19 | P1 | M | Verify contact form validation, submission, and recovery |
| UX-20 | P2 | M | Polish scheduling and newsletter fallback states |
| UX-21 | P1 | L | Create consistent studio entry points and first-use guidance |
| UX-22 | P1 | L | Audit studio responsiveness, panels, and input methods |
| UX-23 | P1 | M | Make studio editing states and recovery predictable |
| UX-24 | P2 | M | Unify arcade discovery, launch, and return flows |
| UX-25 | P1 | L | Complete a keyboard and screen-reader journey audit |
| UX-26 | P1 | M | Make motion and audio restrained and controllable |
| UX-27 | P1 | M | Replace generic loading screens with stable page-family skeletons |
| UX-28 | P1 | M | Polish empty, error, offline, and missing-page experiences |
| UX-29 | P1 | M | Keep authentication failures out of public portfolio journeys |
| UX-30 | P1 | M | Make status labels and performance claims trustworthy |
| UX-31 | P1 | L | Establish a visual and interaction regression gate |
| UX-32 | P1 | M | Verify perceived performance and real-device layout quality |

## Recommended delivery order

1. Establish direction and evidence: UX-01–04 and UX-02’s route inventory.
2. Polish the primary journey: UX-05–19, UX-27–30; review existing draft changes first.
3. Finish deeper experiences: UX-20–26, with each studio and cabinet tracked separately during implementation.
4. Release verification: UX-31–32, including real-device sign-off.

## Ticket specifications

### UX-01: Define the portfolio’s visual system and reference layouts

**Area:** Foundation · **Priority:** P1 · **Size:** M

**Evidence:** Design proposal.

**Scope:** `app/globals.css`; `components/PageLayout.tsx`.

**Problem / opportunity:** The site has an established graphite and amber palette, but page families need a shared hierarchy for type, spacing, borders, controls, and metadata.

**Acceptance criteria:**

- [ ] Document tokens for surfaces, text, spacing, radii, focus, and semantic status colors; retain the architectural palette.
- [ ] Approve reference layouts for homepage, project index, case study, and studio shell at mobile and desktop sizes.
- [ ] Define a distinctive editorial motif based on project diagrams and real artifacts; avoid generic decorative gradients and icon grids.

**Depends on:** None.

### UX-02: Create a route-by-route visual baseline

**Area:** Foundation · **Priority:** P1 · **Size:** M

**Evidence:** Audit required.

**Scope:** `app/**/page.tsx`; `__tests__/e2e/visual.spec.ts`.

**Problem / opportunity:** A guarantee of visual consistency requires a reproducible inventory; only the homepage has been visually inspected during this session.

**Acceptance criteria:**

- [ ] Capture every public route at 320, 375, 768, and 1440px, including representative dynamic case-study pages.
- [ ] Record default, loading, empty, error, and interactive states where applicable; record both persona settings.
- [ ] Track every discovered overlap, clipping, missing asset, or unexpected layout shift with a reproducible route and screenshot.

**Depends on:** None.

### UX-03: Improve text hierarchy and contrast throughout the site

**Area:** Foundation · **Priority:** P1 · **Size:** M

**Evidence:** Source-supported concern.

**Scope:** `app/globals.css`; `components/Navbar.tsx`; `components/Hero.tsx`; `components/Footer.tsx`.

**Problem / opportunity:** Many labels use 9–11px uppercase monospace. Dense technical styling competes with the information visitors need to read.

**Acceptance criteria:**

- [ ] Use readable body text and reserve small monospace type for secondary metadata; do not encode essential instructions only in tiny text.
- [ ] Verify AA text contrast, control contrast, visible focus, and hover/disabled states against actual surfaces.
- [ ] Validate 200% zoom and increased text spacing without clipped content.

**Depends on:** UX-01.

### UX-04: Eliminate overflow and collisions across shared layout primitives

**Area:** Foundation · **Priority:** P1 · **Size:** M

**Evidence:** Audit required.

**Scope:** `components/PageLayout.tsx`; `components/BentoGrid.tsx`; `app/globals.css`.

**Problem / opportunity:** Existing defensive classes and tests provide a foundation, but browser measurements must verify the rendered result.

**Acceptance criteria:**

- [ ] Require zero unintended horizontal overflow at the baseline viewports, including long URLs and 40% text expansion.
- [ ] Allow intentional code/table/canvas scrolling only within labeled, usable containers.
- [ ] Verify fixed navigation, sticky controls, toasts, and dialogs do not hide content or focus indicators.

**Depends on:** UX-02.

### UX-05: Resolve hero crowding and establish a clear first impression

**Area:** Homepage · **Priority:** P1 · **Size:** S

**Evidence:** Observed; draft changes exist.

**Scope:** `components/Hero.tsx`.

**Problem / opportunity:** The original desktop preview showed the identity badge overlapping a decorative corner label; the headline and microcopy also made the opening screen crowded.

**Acceptance criteria:**

- [ ] Identity, headline, description, and primary action have distinct space at every baseline viewport.
- [ ] Explain the owner’s work and value without absolute reliability claims.
- [ ] Keep one obvious primary action and ensure the headline is readable before hydration.

**Depends on:** UX-01.

### UX-06: Make the engineering demo responsive and keyboard accessible

**Area:** Homepage · **Priority:** P1 · **Size:** M

**Evidence:** Observed; draft changes exist.

**Scope:** `components/Hero.tsx`.

**Problem / opportunity:** The original demo tab strip clipped options; its long labels and status rows compete for limited card width.

**Acceptance criteria:**

- [ ] Show all three demo choices without accidental clipping; keep controls usable at 320px.
- [ ] Implement tab/panel relationships, selected state, arrow-key navigation, and appropriate focus behavior.
- [ ] Exercise every demo and reset state; prevent content collisions and disruptive height jumps.

**Depends on:** UX-03, UX-04.

### UX-07: Stabilize hero text rendering and selection

**Area:** Homepage · **Priority:** P1 · **Size:** M

**Evidence:** Source-supported concern.

**Scope:** `components/Hero.tsx`; `hooks/usePretextLayout.tsx`.

**Problem / opportunity:** The hero combines measured heights, animated word wrapping, and transparent semantic overlays; their line layouts and responsive metrics can differ.

**Acceptance criteria:**

- [ ] Compare SSR, hydration, web-font loading, and settled layouts at each baseline viewport.
- [ ] Keep visible and selectable text aligned; preserve one meaningful heading in the accessibility tree.
- [ ] Measure layout shift and verify readable fallback output with JavaScript unavailable and reduced motion enabled.

**Depends on:** UX-05.

### UX-08: Improve homepage pacing and reduce unnecessary scrolling

**Area:** Homepage · **Priority:** P2 · **Size:** M

**Evidence:** Source-supported concern.

**Scope:** `app/page.tsx`; `components/TextReveal.tsx`; `components/DeferredHydration.tsx`.

**Problem / opportunity:** The philosophy statement reserves 75–100vh and the page combines projects, skills, a long timeline, multiple contact links, and a full form.

**Acceptance criteria:**

- [ ] Give each section one clear purpose and a consistent spacing rhythm.
- [ ] Keep the philosophy statement readable without requiring a long scroll animation; respect reduced motion.
- [ ] Review the mobile journey from first impression through selected work to contact and remove redundant transitions.

**Depends on:** UX-01, UX-05.

### UX-09: Curate featured projects around evidence and outcomes

**Area:** Homepage · **Priority:** P1 · **Size:** M

**Evidence:** Source-supported concern.

**Scope:** `components/ProjectTeaserGrid.tsx`; `app/page.tsx`.

**Problem / opportunity:** Featured work currently takes the first three returned case studies. That order does not explicitly encode the strongest professional narrative.

**Acceptance criteria:**

- [ ] Define an intentional featured selection with a clear visitor-facing reason for each project.
- [ ] Each teaser communicates problem, contribution, outcome, and an accurate destination.
- [ ] Use genuine screenshots, diagrams, or artifacts where useful; preserve a coherent fallback when assets or data are unavailable.

**Depends on:** UX-01.

### UX-10: Make project snippets readable and visually consistent

**Area:** Homepage · **Priority:** P2 · **Size:** M

**Evidence:** Source-supported concern.

**Scope:** `components/ProjectTeaserGrid.tsx`.

**Problem / opportunity:** Descriptions are cut at a character count, which can end mid-word or split inline formatting; long project names dominate the cards.

**Acceptance criteria:**

- [ ] Truncate at sensible text boundaries or use a tested line-based treatment with access to the complete summary.
- [ ] Ensure long titles, technology tags, and rich-text snippets cannot break card bounds.
- [ ] Align card actions while allowing text to grow at zoom; preserve full accessible link names.

**Depends on:** UX-03, UX-09.

### UX-11: Simplify global navigation and clarify destination names

**Area:** Navigation · **Priority:** P1 · **Size:** M

**Evidence:** Observed / design proposal.

**Scope:** `components/Navbar.tsx`; `components/Footer.tsx`; `components/CommandPalette.tsx`.

**Problem / opportunity:** The desktop header combines route links, multiple menus, search, two persona buttons, and sound settings. Labels such as Systems and Arcade & Labs need clear grouping.

**Acceptance criteria:**

- [ ] Establish a small set of primary destinations with readable names and consistent grouping.
- [ ] Keep primary navigation usable at intermediate widths without shrinking controls excessively.
- [ ] Synchronize destination names and route coverage across header, mobile drawer, footer, search, and metadata discovery contracts.

**Depends on:** UX-01.

### UX-12: Verify mobile navigation and desktop menu interaction

**Area:** Navigation · **Priority:** P1 · **Size:** M

**Evidence:** Audit required; focus handling exists.

**Scope:** `components/Navbar.tsx`; `hooks/useFocusTrap.ts`.

**Problem / opportunity:** The code already contains focus and Escape handling; this ticket verifies complete behavior rather than assuming it is absent.

**Acceptance criteria:**

- [ ] Test open, close, Escape, outside click, route selection, focus restoration, and background scroll locking.
- [ ] Ensure all menu content remains reachable in short landscape viewports and at 200% zoom.
- [ ] Use menu semantics only with matching keyboard behavior; keep tap targets comfortably sized.

**Depends on:** UX-11.

### UX-13: Explain persona switching and preserve visitor orientation

**Area:** Navigation · **Priority:** P2 · **Size:** M

**Evidence:** Observed / design proposal.

**Scope:** `components/Navbar.tsx`; `components/providers/PersonaProvider.tsx`; `components/providers/TerminologyProvider.tsx`.

**Problem / opportunity:** TECH and REC are terse labels for a setting that can change content and terminology across the page.

**Acceptance criteria:**

- [ ] Explain each reading mode with clear visible labels or accessible help.
- [ ] Switch without losing scroll position, focus, or access to projects; avoid surprising layout jumps.
- [ ] Persist selection predictably and verify default, stored, and storage-unavailable states.

**Depends on:** UX-11.

### UX-14: Polish search and command-palette discovery

**Area:** Navigation · **Priority:** P1 · **Size:** M

**Evidence:** Audit required.

**Scope:** `components/CommandPalette.tsx`; `components/SearchWrapper.tsx`.

**Problem / opportunity:** Search is a core wayfinding path and needs to feel complete for keyboard and touch users.

**Acceptance criteria:**

- [ ] Verify keyboard opening, arrow navigation, Enter selection, Escape, focus restoration, and screen-reader announcements.
- [ ] Provide useful empty-query suggestions and a helpful no-results state with an easy reset.
- [ ] Keep matching, titles, previews, status labels, and destinations accurate; ensure results remain scrollable above the mobile keyboard.

**Depends on:** UX-11, UX-12.

### UX-15: Make the case-study index easy to scan and explore

**Area:** Projects · **Priority:** P1 · **Size:** M

**Evidence:** Audit / design proposal.

**Scope:** `app/case-studies/page.tsx`; `components/CaseStudy*`.

**Problem / opportunity:** A growing portfolio needs a clear browsing model beyond a dense feed of technical titles.

**Acceptance criteria:**

- [ ] Verify or add meaningful domain/technology filters and a visible reset without introducing unnecessary controls.
- [ ] Give each entry a concise summary and consistent links to its case study, demo, and source when available.
- [ ] Maintain useful loading, no-results, and empty-data states; preserve filter state on return from a detail page.

**Depends on:** UX-09, UX-10.

### UX-16: Standardize case studies around problem, decisions, and results

**Area:** Projects · **Priority:** P1 · **Size:** L

**Evidence:** Audit / design proposal.

**Scope:** `app/case-studies/[slug]/page.tsx`; `app/work/laser-loon/page.tsx`.

**Problem / opportunity:** The professional story should be understandable before visitors encounter implementation detail.

**Acceptance criteria:**

- [ ] Use a consistent opening summary: problem, role, constraints, approach, and supported outcomes.
- [ ] Provide readable long-form typography, artifact captions, responsive media, and accessible tables/code blocks.
- [ ] Include clear demo/source actions, contextual return navigation, and related work without duplicate competing calls to action.

**Depends on:** UX-01, UX-15.

### UX-17: Improve experience and skills storytelling

**Area:** Projects · **Priority:** P2 · **Size:** M

**Evidence:** Source-supported concern.

**Scope:** `components/SkillsGrid.tsx`; `components/Timeline.tsx`.

**Problem / opportunity:** The about area contains dense biography text, codebase distribution, domain descriptions, and two timeline perspectives.

**Acceptance criteria:**

- [ ] Lead with a short professional narrative and a small set of concrete strengths.
- [ ] Make role, organization, dates, and accomplishments easy to scan; preserve detail through accessible disclosure where appropriate.
- [ ] Explain what codebase-distribution data measures and avoid presenting mixed categories as equivalent programming languages.

**Depends on:** UX-03, UX-13.

### UX-18: Create a clear contact journey with fewer competing actions

**Area:** Contact · **Priority:** P1 · **Size:** M

**Evidence:** Observed / design proposal.

**Scope:** `app/page.tsx`; `app/contact/page.tsx`; `app/schedule/page.tsx`.

**Problem / opportunity:** The homepage offers a separate contact-page link, booking, social profiles, and a full contact form in the same section.

**Acceptance criteria:**

- [ ] Choose one primary contact action and make booking and social links secondary.
- [ ] Explain what information is useful and what happens after submission without unsupported delivery promises.
- [ ] Keep the contact experience consistent between the homepage and dedicated page.

**Depends on:** UX-01.

### UX-19: Verify contact form validation, submission, and recovery

**Area:** Contact · **Priority:** P1 · **Size:** M

**Evidence:** Audit required; validation exists.

**Scope:** `components/ContactForm.tsx`.

**Problem / opportunity:** The form already has validation and request states; usability depends on how those states behave together.

**Acceptance criteria:**

- [ ] Associate errors with fields; focus the first invalid field or error summary and retain entered values.
- [ ] Test malformed input, pending submission, duplicate clicks, network failure, rate limits, and success using mocked requests.
- [ ] Provide clear retry and success feedback without sending real messages during tests; verify autofill and mobile keyboard behavior.

**Depends on:** UX-18.

### UX-20: Polish scheduling and newsletter fallback states

**Area:** Contact · **Priority:** P2 · **Size:** M

**Evidence:** Audit required.

**Scope:** `app/schedule/page.tsx`; `components/Footer.tsx`.

**Problem / opportunity:** External booking and subscription flows should remain understandable when third-party resources fail or a request is rejected.

**Acceptance criteria:**

- [ ] Show timezone and duration clearly wherever booking details are available.
- [ ] Provide a usable fallback link or contact alternative when embedded booking cannot load.
- [ ] Test newsletter validation, loading, errors, and success with mocked submissions; explain the content and frequency without unsupported claims.

**Depends on:** UX-18, UX-19.

### UX-21: Create consistent studio entry points and first-use guidance

**Area:** Studios and arcade · **Priority:** P1 · **Size:** L

**Evidence:** Audit / design proposal.

**Scope:** `app/proof/page.tsx`; `app/crf/page.tsx`; `app/simulator/page.tsx`; `app/neuro/page.tsx`.

**Problem / opportunity:** Each technical workspace needs to orient a first-time visitor quickly while retaining expert depth.

**Acceptance criteria:**

- [ ] Show the purpose, a useful initial example, and one obvious first action for each studio.
- [ ] Explain specialized terms in context and offer a guided sample or reset path.
- [ ] Keep return-to-portfolio navigation visible and distinguish local studio settings from global site settings.

**Depends on:** UX-01, UX-11.

### UX-22: Audit studio responsiveness, panels, and input methods

**Area:** Studios and arcade · **Priority:** P1 · **Size:** L

**Evidence:** Audit required.

**Scope:** `components/crf/`; `components/proof/`; `components/neuro/`; `app/simulator/`.

**Problem / opportunity:** Canvas and multi-panel tools need explicit behavior when screen space or input capabilities change.

**Acceptance criteria:**

- [ ] Verify each panel and primary action at mobile, tablet, desktop, and 200% zoom; document experiences that require a larger screen.
- [ ] Use accessible disclosure or panel switching on small screens while preserving current work.
- [ ] Test touch, keyboard, focus order, container themes, and browser address-bar changes; prevent trapped scrolling.

**Depends on:** UX-04, UX-21.

### UX-23: Make studio editing states and recovery predictable

**Area:** Studios and arcade · **Priority:** P1 · **Size:** M

**Evidence:** Audit required.

**Scope:** `app/proof/`; `app/crf/`; `app/neuro/`; `components/crf/*Studio*`.

**Problem / opportunity:** Visitors need confidence about what is saved, shared, reset, or lost during interactive work.

**Acceptance criteria:**

- [ ] Audit and document persistence, URL sharing, import/export, reset, and navigation behavior for each studio.
- [ ] Provide confirmation or undo for destructive workspace actions and useful import/validation error messages.
- [ ] Verify that shared URLs restore supported state and that failures preserve recoverable user work.

**Depends on:** UX-21.

### UX-24: Unify arcade discovery, launch, and return flows

**Area:** Studios and arcade · **Priority:** P2 · **Size:** M

**Evidence:** Audit required.

**Scope:** `app/arcade/page.tsx`; `app/arcade/*/page.tsx`; `components/arcade/PlayCabinet.tsx`.

**Problem / opportunity:** Novel games should be easy to start without needing to infer controls or understand the underlying engine.

**Acceptance criteria:**

- [ ] Each game exposes purpose, controls, supported input, launch, pause/reset, and a clear return route.
- [ ] Verify launch/warmup, loading failure, game-over, retry, and touch layouts for every cabinet.
- [ ] Provide canvas descriptions and keyboard alternatives where feasible; explain genuine input limitations before launch.

**Depends on:** UX-11, UX-22.

### UX-25: Complete a keyboard and screen-reader journey audit

**Area:** Accessibility and motion · **Priority:** P1 · **Size:** L

**Evidence:** Audit required; accessibility infrastructure exists.

**Scope:** `app/layout.tsx`; `components/SkipToContent.tsx`; `components/providers/A11yProvider.tsx`.

**Problem / opportunity:** Existing skip links, announcers, and focus utilities need end-to-end verification across page and overlay states.

**Acceptance criteria:**

- [ ] Verify skip navigation, heading order, landmarks, names, state announcements, and visible focus across primary journeys.
- [ ] Test dialogs, drawers, tooltips, tabs, and validation using keyboard alone and a screen reader.
- [ ] Resolve critical, serious, and moderate axe findings and record manual checks that automation cannot cover.

**Depends on:** UX-02, UX-12, UX-14, UX-19, UX-22.

### UX-26: Make motion and audio restrained and controllable

**Area:** Accessibility and motion · **Priority:** P1 · **Size:** M

**Evidence:** Source-supported concern.

**Scope:** `components/TextReveal.tsx`; `components/AnimatedGridPattern.tsx`; `components/FooterStatusTicker.tsx`; `components/providers/AudioProvider.tsx`.

**Problem / opportunity:** The site combines entrance animations, scroll effects, grid animation, rotating status text, and playful audio interactions.

**Acceptance criteria:**

- [ ] Honor reduced motion across all these surfaces and keep content understandable with animation disabled.
- [ ] Keep audio opt-in, clearly indicate its state, and verify touch interactions do not accidentally produce hover sounds.
- [ ] Pause or stop nonessential persistent motion where required; avoid layout-affecting animation and background work in hidden tabs.

**Depends on:** UX-01, UX-25.

### UX-27: Replace generic loading screens with stable page-family skeletons

**Area:** Reliability and states · **Priority:** P1 · **Size:** M

**Evidence:** Confirmed source issue.

**Scope:** `app/loading.tsx`; `app/case-studies/[slug]/loading.tsx`; `components/DeferredHydration.tsx`.

**Problem / opportunity:** The root loading component renders a main element inside the root layout’s existing main, and uses a generic feed skeleton with a large blur layer.

**Acceptance criteria:**

- [ ] Use exactly one main landmark during loading and settled rendering.
- [ ] Match skeleton geometry to the page family, avoid misleading status content, and provide a concise accessible loading indication.
- [ ] Verify slow loading, reduced motion, narrow widths, and the transition to real content without large shifts.

**Depends on:** UX-02, UX-04.

### UX-28: Polish empty, error, offline, and missing-page experiences

**Area:** Reliability and states · **Priority:** P1 · **Size:** M

**Evidence:** Source-supported concern / audit.

**Scope:** `app/error.tsx`; `app/global-error.tsx`; `app/offline/page.tsx`; `components/UnifiedErrorLayout.tsx`; `app/page.tsx`.

**Problem / opportunity:** The homepage’s empty state currently describes the active environment and repository specifications, which is implementation detail rather than helpful visitor guidance.

**Acceptance criteria:**

- [ ] Use plain explanations with appropriate retry, back, home, or contact actions.
- [ ] Keep error and offline layouts visually consistent and keyboard accessible; avoid infinite retry loops.
- [ ] Test missing projects, unavailable data, failed imports, and disconnected network states without exposing secrets or raw stack traces.

**Depends on:** UX-01, UX-27.

### UX-29: Keep authentication failures out of public portfolio journeys

**Area:** Reliability and states · **Priority:** P1 · **Size:** M

**Evidence:** Observed; draft changes exist.

**Scope:** `app/layout.tsx`; `app/admin/layout.tsx`; `lib/security-headers.ts`.

**Problem / opportunity:** The preview displayed Clerk script errors on the public homepage. The existing CSP omitted Clerk sources; provider isolation and CSP corrections have been drafted but need final verification.

**Acceptance criteria:**

- [ ] Public pages render and remain interactive without downloading the Clerk browser SDK.
- [ ] Admin login loads its required resources under a narrowly configured CSP and retains server-side access protection.
- [ ] Verify the reported server-action error independently; distinguish stale local server failures from reproducible application defects.

**Depends on:** None.

### UX-30: Make status labels and performance claims trustworthy

**Area:** Reliability and states · **Priority:** P1 · **Size:** M

**Evidence:** Observed / source-supported concern.

**Scope:** `components/FooterStatusTicker.tsx`; `components/Footer.tsx`; `components/Hero.tsx`; `components/SkillsGrid.tsx`.

**Problem / opportunity:** The original preview labeled playful messages as live telemetry and displayed absolute claims such as zero latency and bug-free inference results.

**Acceptance criteria:**

- [ ] Identify every metric and status as measured, cached, simulated, or illustrative; remove unsupported absolute claims.
- [ ] Use real health data only when its source, scope, and freshness are available.
- [ ] Keep personality in clearly optional playful interactions without making system reliability ambiguous.

**Depends on:** UX-05, UX-17.

### UX-31: Establish a visual and interaction regression gate

**Area:** Performance and QA · **Priority:** P1 · **Size:** L

**Evidence:** Audit / test infrastructure extension.

**Scope:** `__tests__/e2e/visual.spec.ts`; `__tests__/e2e/synthetic-probes.spec.ts`.

**Problem / opportunity:** Static class assertions do not prove that the final browser layout is intact; the repo already has browser probes to extend.

**Acceptance criteria:**

- [ ] Add stable screenshots and bounding-box checks for the agreed route/state matrix with deterministic data.
- [ ] Cover menu/search interactions, persona changes, contact errors, studio entry, and arcade launch; use hydration-safe interaction polling.
- [ ] Run browser checks for Chromium and WebKit, record approved baseline changes, and ensure failures identify a route, state, and viewport.

**Depends on:** UX-02, UX-25, UX-27.

### UX-32: Verify perceived performance and real-device layout quality

**Area:** Performance and QA · **Priority:** P1 · **Size:** M

**Evidence:** Audit required.

**Scope:** `lib/dx/page-bench.ts`; `scripts/benchmark-pages.ts`; `__tests__/e2e/visual.spec.ts`.

**Problem / opportunity:** Visual polish includes fast initial content, responsive controls, and stable layouts on actual devices.

**Acceptance criteria:**

- [ ] Benchmark production builds and meet the repo’s LCP ≤ 2500ms, TTFB ≤ 800ms, and CLS ≤ 0.1 budgets; investigate outliers individually.
- [ ] Profile scroll and interaction responsiveness on mobile and remove expensive blur, layout recalculation, or unnecessary hydration where measured.
- [ ] Complete manual iOS Safari and Android checks, including large text, landscape, virtual keyboard, and safe-area behavior.

**Depends on:** UX-07, UX-22, UX-26, UX-31.

## Definition of done for implementation tickets

- Acceptance criteria pass with before/after evidence appropriate to the change.
- Changed components work at 320px, 375px, 768px, and 1440px, plus 200% zoom and expanded text.
- Keyboard focus, touch targets, reduced motion, and relevant loading/error states are checked.
- No unintended layout overflow, blocked primary actions, broken links, or new browser errors in the tested states.
- Run the repo-required quality gates and relevant tests; regenerate public API docs if contracts change.
- Do not claim comprehensive device coverage until the route/state matrix and manual device checks are complete.
