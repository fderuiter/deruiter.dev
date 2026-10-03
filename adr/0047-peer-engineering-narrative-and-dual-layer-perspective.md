# ADR 0047: Peer Engineering Narrative and the Dual-Layer Perspective

## Status

Accepted on 2026-10-02. Governs epic #910 and its child tickets #917, #926
and #927. Supersedes the "Recruiter vs. Reality" toggle described in
[ADR 0015](0015-human-first-editorial-voice-and-responsive-layout-standardization.md)
and the recruiter audience named in
[ADR 0041](0041-blog-content-architecture-and-editorial-scope.md). The rest of
both ADRs stands.

## Context

The site grew up as a portfolio aimed partly at hiring audiences. The reading
toggle was called Recruiter / Technical, the career timeline offered a
"Formal Summary", the contact page asked whether the visitor had "a role I
might fit", and the homepage contact section listed "a job" among the reasons
to get in touch. The contact form offered a `recruiting` intent.

None of that is true any more. Fred is a Clinical Data Specialist at BRIGHT
Research Partners and is happy there. The site is a peer engineering
showcase: clinical data systems, side projects, open-source tooling and a
fair number of games. Copy that reads like a job search tells visitors the
wrong thing about why the site exists, and it ages the BRIGHT entry into a
résumé line when it is current work.

The two-layer reading experience is worth keeping. Some visitors want the
short account of what a system does and why; others want the story of how it
actually went. The problem is the names, not the mechanism.

## Decision

### Rename the layers, keep the mechanism

The reading mode keeps its provider (`PersonaProvider`), its storage key
(`global-persona`) and its behavior. Its values and labels change:

| Before                    | After                                     | Short label |
| ------------------------- | ----------------------------------------- | ----------- |
| Recruiter (`"recruiter"`) | Professional (`"professional"`)           | `PRO`       |
| Technical (`"technical"`) | Behind the Scenes (`"behind-the-scenes"`) | `STORY`     |

- **Professional is the default.** A first visit, an unknown stored value and
  blocked storage all resolve to Professional.
- **One contract.** `lib/persona.ts` owns `PersonaType`, the default, the
  storage key, `normalizePersona()` and the screen-reader announcements.
  The navbar, case-study showcase, bento cards and timeline all import it.
  `"recruiter"` is no longer part of the public type.
- **Announcements.** Switching mode announces "Professional Mode: Concise
  overview of technical responsibilities and systems impact" or "Behind the
  Scenes Mode: Candid reality and engineering stories".
- **Short labels where space is tight.** The desktop bar shows `PRO` (and
  `PROFESSIONAL` at 2xl) beside `STORY`; the mobile drawer has room for
  `PROFESSIONAL` and `BEHIND THE SCENES`. Every button carries the full name in
  its accessible label.

### Returning visitors keep their mode

Values written before the rename are read, mapped and rewritten, never
written. `LEGACY_SUMMARY_PERSONA_VALUE` and `LEGACY_DEEP_DIVE_PERSONA_VALUE`
in `lib/persona.ts` name them. `normalizePersona()` maps the deep-dive value
to Behind the Scenes and everything else to Professional, and the provider
rewrites a legacy value under the same key on first read. Case-study deep
links shared with `#role=` set to either legacy value open the renamed tab.

### Nothing is hidden by mode

The Arcade footer column and the homepage "Yes, there are games." teaser used
to disappear in the deep-dive mode. They now render in both modes. A reading
mode changes how things are told, not what exists. (The Incident Simulator
link keeps its existing mode gating; that is a navigation decision outside
this ADR.)

### The career timeline

The timeline's header switcher offers "Professional Summary" and "Behind the
Scenes Reality", and each card's toggle flips between the two. The BRIGHT
Research Partners entry describes active, ongoing clinical database
architecture and GxP validation work in the Professional Summary, and keeps
the candid "footnotes tend to earn their keep" version behind the scenes.
`TimelineItem.recruiterDescription` becomes `professionalDescription`.

### Copy invites peers, not offers

- Homepage Section 04 asks about side projects, technical questions and
  open-source bugs. The 30-minute card is a "Coffee Chat / Tech Talk" about
  clinical software and side projects.
- `/contact` invites interesting builds, open-source ideas and clinical data
  problems. Its metadata and social card drop "roles" and "consulting
  opportunities".
- `/schedule` describes a 30-minute chat between peers rather than a
  consultation.
- The contact form no longer offers the `recruiting` intent. The API schema
  still accepts it, so saved drafts and queued offline submissions validate.

### A regression test holds the line

`__tests__/peer-narrative-copy.test.ts` scans user-facing source (`app/`,
`components/`, `lib/i18n-dictionary.ts`, the case-study, blog, FAQ and SEO
content modules, and `lib/persona.ts`) for the retired phrases: "recruiter"
(case-insensitive), "a role I might fit", "a job", "the exact skills Fred
brings" and "hiring engineering leaders". The only allowed occurrence is the
`LEGACY_SUMMARY_PERSONA_VALUE` declaration, which has to spell the old value to
migrate it.

## Consequences

- Returning visitors land in the mode they chose. Their stored value is
  respelled once and never read in the old form again.
- External links with `#role=recruiter` or `#role=technical` keep working.
  New links use the new values.
- The interactive teaser and Arcade column cost a few hundred bytes of markup
  in Behind the Scenes mode that they used to skip. The footer grid is always
  five columns at `lg`.
- Screenshot baselines that show the reading toggle, the timeline header, the
  homepage contact section or the contact page header change and must be
  regenerated deliberately.
- New copy that drifts back toward hiring language fails the regression test
  rather than review. Historical ADRs are not scanned; they record what was
  decided at the time.
