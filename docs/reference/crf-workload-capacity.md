# CRF Studio Workload Capacity Report

Measured: 2026-10-03, run `crf-workloads-2026-10-03T01-54-33-934Z` (issue [#682](https://github.com/fderuiter/deruiter.dev/issues/682))

Scope: the CRF Studio authoring workflows on `main` (edit, Form Grid, scenario run, save and reopen, baseline comparison, export), on three deterministic synthetic studies. Records are synthetic. This report states what was observed on one recorded machine. It does not set supported limits or budgets, and it says nothing about clinical or regulatory fitness.

> [!NOTE]
> This is a dated snapshot. Re-run `npm run bench:crf` before relying on any number, and compare runs only when they come from the same machine and the same build. Each run writes its raw evidence (every sample, with provenance) to `.benchmark-results/crf/`.

## Reproduce

```bash
npm run build                                   # production build in .next/
npm run bench:crf                               # engine + browser, all workloads
npm run bench:crf -- --phase engine             # Node only, no build needed
npm run bench:crf -- --workloads stress --browser-runs 1
```

`bench:crf` runs `scripts/benchmark-crf.ts` under `tsx --expose-gc`. Shared step types live in `scripts/benchmark-crf-shared.ts`. The browser phase (`scripts/benchmark-crf-browser.ts`) starts `next start` from the existing `.next` build on `--port` (default 3200), or uses `--base-url` for a server that is already running. Set `CRF_BENCH_DEBUG_DIR` to save a screenshot of every failed browser step. The benchmark is not part of `npm test`. The unit test `__tests__/crf-workloads.test.ts` checks only that the workload generator is deterministic and produces the declared sizes.

## Workloads

`lib/dx/crf-workloads.ts` generates each study from a fixed seed, with fixed ids and timestamps, so every run measures a byte-identical document. Each form has the same structure: a Yes/No gate, weight and height, a calculated BMI, a 4-column repeating table, sections of 10 fields (every third form's second section repeats), and a seeded mix of integer, date, select, radio, textarea, checkbox and text fields. Forms use sponsor-defined domain codes (`X*` and `Z*`), so the studies pass conformance cleanly, as a reviewed study would. Every tenth form, or the last form in a study with fewer than ten, is a log form assigned to a Common visit. Rules rotate through show, range query, grouped require and hide. Saved scenarios exercise the show and hide rules plus the calculation, and all of them pass against the pristine study.

| Workload | Forms | Fields | Repeat columns | Visits (1 repeating) | Visit-form assignments | Rules | Saved scenarios | Draft JSON |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| small | 5 | 100 | 20 | 6 | 14 | 16 | 5 | 30 KiB |
| typical | 30 | 1,000 | 120 | 14 | 181 | 123 | 60 | 257 KiB |
| stress | 100 | 5,000 | 400 | 32 | 1,408 | 610 | 200 | 1,178 KiB |

`amendCrfWorkload` applies a known amendment for the baseline comparison: one field label changes in each of the first 10 forms (5 in small), and the study version is bumped.

## Provenance

| Item | Value |
| --- | --- |
| Source | `0665a79fbbf0fe55b7ce5009e7d49184c958dece` (`origin/main`). The working tree was dirty only with the benchmark's new files; no CRF feature code was changed. |
| Build | `ECS08TO1x0pdr2BFVoMzr`, `npm run build` from a clean tree at that revision (`.next/build-provenance.json`: `sourceDirty: false`) |
| Browser | Headless Chromium 141.0.7390.37, Playwright 1.63.0, desktop viewport 1440x900, no CPU or network throttling |
| Node | v22.22.0, with `--expose-gc` |
| Machine | 4 x Intel Xeon @ 2.10GHz, 15.7 GiB, Linux 6.18 x64, a shared cloud container |
| Load | 1-minute load average 5.3 at the start and 10.7 at the end of the run. Other builds shared the machine, so absolute latency is pessimistic and noisy. |
| Sampling | Engine: 1 warm-up and 5 measured iterations per step. Browser: 3 fresh sessions per workload, with samples pooled. |
| Automation overhead | The same input sequences on a trivial page took 108 ms (click), 58 ms (typing 7 characters) and 17 ms (10 arrow keys). Browser latencies include this overhead. |

## Engine phase

These are the public `lib/crf` functions the studio calls, run in Node. Each cell is the median / p95 in milliseconds over 5 iterations. Every step passed except one, which was skipped.

| Workflow | Step | small | typical | stress |
| --- | --- | ---: | ---: | ---: |
| edit | `updateField` (label) | 0.0 / 0.1 | 0.1 / 0.1 | 0.0 / 0.0 |
| edit | `renameFieldEverywhere` (formula-referenced) | 0.1 / 0.4 | 0.4 / 0.5 | 1.0 / 2.7 |
| edit | `validateStudyCompliance` (header diagnostics) | 0.0 / 0.0 | 0.4 / 0.6 | 1.9 / 2.3 |
| scenario | `runScenariosForForm` over all forms (all saved scenarios pass) | 5.4 / 7.8 | 26.1 / 26.2 | 95.3 / 104.5 |
| scenario | `fillSampleValues` + `runFormTest`, largest form | 0.1 / 0.1 | 0.1 / 0.2 | 0.1 / 0.1 |
| save-reopen | `saveStudyDraft` | 0.1 / 0.1 | 0.6 / 0.7 | 2.8 / 3.0 |
| save-reopen | `loadStudyDraft` + identity check (identical) | 2.3 / 2.4 | 10.3 / 10.4 | 48.0 / 68.0 |
| save-reopen | `parseUniversalCrf`, schema-validated native reopen (structure preserved) | 2.0 / 2.9 | 7.3 / 13.2 | 25.1 / 30.5 |
| save-reopen | Truncated draft reported `corrupt`, backup preserved | 0.1 / 0.2 | 1.3 / 1.6 | 5.3 / 5.4 |
| baseline | `saveStudyBaseline` (clone, checksum, persist) | 1.3 / 1.4 | 9.0 / 10.9 | 38.5 / 42.6 |
| baseline | `compareStudyToBaseline` (finds every amendment) | 1.7 / 4.9 | 7.3 / 8.2 | 32.6 / 33.2 |
| export | ODM-XML | 1.1 / 1.6 | 3.3 / 4.6 | 14.7 / 20.0 |
| export | ODM-XML reimport | skipped | skipped | skipped |
| export | USDM JSON | 1.0 / 1.2 | 6.9 / 7.7 | 27.9 / 29.9 |
| export | SAS, whole study | 1.4 / 1.5 | 3.8 / 5.7 | 11.0 / 12.0 |
| export | R, whole study | 2.1 / 3.7 | 4.5 / 5.1 | 14.5 / 15.1 |
| export | FHIR Questionnaire bundle | 4.3 / 4.4 | 12.2 / 13.3 | 41.7 / 45.9 |
| export | aCRF HTML book | 1.3 / 1.4 | 2.7 / 3.1 | 10.4 / 12.7 |
| export | DOCX, annotated, all forms | 86 / 104 | 829 / 1,037 | 4,289 / 4,577 |
| export | PDF, annotated, all forms | 62 / 75 | 480 / 524 | 2,492 / 2,749 |

The ODM parser needs the browser's `DOMParser`. A jsdom stand-in took 28.7 s on the typical study, which measures jsdom rather than the parser, so the step is recorded as skipped. The reimport is measured through the studio's importer in the browser phase below. The generated document retains 0.1, 0.4 and 1.8 MiB of Node heap for the three workloads. The full set of export, YAML and per-form rows is in the run's evidence file.

## Browser phase

This phase drives the real `/crf` page of the production build. Each session seeds `localStorage` the way an author's earlier session would have left it: the amended study as the draft, and the pristine study as a baseline. Each cell is the median latency in ms, with the slowest of 3 runs in brackets, then three responsiveness figures in parentheses: the number of long tasks, the longest task in ms, and the longest Event Timing input entry in ms (an INP proxy). A dash means no input entry exceeded 16 ms. Every step passed in every run.

| Workflow | Step | small | typical | stress |
| --- | --- | --- | --- | --- |
| save-reopen | Reopen from local draft, navigation to studio ready | 696 [738] (3 / 120 / 72) | 928 [942] (6 / 444 / 24) | 1,656 [1,936] (9 / 1,640 / 24) |
| save-reopen | Reopen, navigation to main thread quiet for 1 s | 874 [919] | 1,927 [2,119] | 1,656 [1,936] |
| edit | Select field (canvas click to inspector) | 250 [269] (1 / 73 / 128) | 418 [649] (1 / 116 / 216) | 1,150 [1,229] (3 / 565 / 768) |
| edit | Type 7 characters into the label | 410 [502] (0 / 0 / 96) | 742 [1,062] (5 / 155 / 216) | 2,464 [2,588] (12 / 423 / 640) |
| save-reopen | Autosave status after the edit (800 ms debounce) | 787 [809] | 814 [830] (0 / 52 / -) | 861 [871] (1 / 154 / -) |
| save-reopen | Edit survives reload | 685 [796] (3 / 124 / 72) | 865 [990] (4 / 413 / 472) | 1,440 [2,351] (8 / 2,164 / 2,336) |
| grid | Open Form Grid (all rows of form 1) | 356 [389] (1 / 83 / 112) | 424 [665] (2 / 260 / 352) | 646 [652] (1 / 250 / 304) |
| grid | Commit one cell edit | 418 [482] (0 / 0 / 128) | 433 [447] (0 / 0 / 192) | 339 [398] (1 / 147 / 96) |
| grid | ArrowDown x10 | 487 [575] (0 / 0 / 168) | 589 [809] (1 / 89 / 168) | 503 [522] (0 / 0 / 152) |
| scenario | Open Form Test dock | 150 [152] | 96 [174] | 115 [156] |
| scenario | Fill sample (runs the form test) | 110 [116] (0 / 0 / 56) | 126 [132] | 97 [113] |
| baseline | Open comparison (UI count equals the engine count) | 172 [176] (2 / 116 / -) | 319 [469] (2 / 300 / -) | 1,586 [1,734] (2 / 1,226 / -) |
| export | Open Exports (Universal JSON preview) | 537 [554] (0 / 0 / 168) | 677 [727] (1 / 119 / 136) | 1,761 [1,891] (2 / 685 / 464) |
| export | Switch to the ODM-XML preview | 72 [75] (0 / 0 / 72) | 559 [732] (3 / 460 / 520) | 2,011 [2,318] (4 / 1,706 / 1,976) |
| export | Download ODM-XML | 63 [82] | 133 [242] (0 / 64 / 32) | 244 [252] (1 / 152 / 56) |
| export | Annotated Word (.docx), all forms | 303 [309] (1 / 146 / -) | 2,120 [2,373] (1 / 1,690 / 2,112) | 7,279 [8,030] (2 / 6,992 / 7,200) |
| export | Annotated PDF, all forms | 248 [250] (1 / 141 / -) | 796 [810] (1 / 662 / -) | 3,058 [4,969] (2 / 4,530 / 2,824) |
| save-reopen | Import native `.crf.json` in a clean profile | 92 [151] | 275 [280] (3 / 150 / -) | 946 [1,091] (5 / 781 / -) |
| save-reopen | Import the ODM-XML export in a clean profile (browser DOMParser) | 59 [77] | 208 [338] (2 / 181 / -) | 882 [1,577] (5 / 703 / -) |

### Memory, size and storage

| Workload | JS heap after reopen | JS heap at end of session | DOM nodes after reopen (study spine) | Baseline snapshots that fit beside the draft | Page errors |
| --- | ---: | ---: | ---: | ---: | --- |
| small | 12.3 MiB | 16.4 MiB | 5,177 (1,676) | 50 of 50 | none |
| typical | 19.0 MiB | 32.1 MiB | 16,991 (11,732) | 18 of 50 | none |
| stress | 52.2 MiB | 95.3 MiB | 79,947 (72,824) | 3 of 50 | none |

The largest single `localStorage` value this Chromium accepted was 5,242,865 characters, found by binary search. The draft and each baseline record take 31, 257 and 1,178 KiB for the three workloads.

## Findings

### Workflows that held up

- Every workflow completed on all three workloads, in every run, with no page error or crash.
- Reopening from the local draft, and from both a native file and an ODM-XML export, reproduced the study. A reload after an edit kept the edit.
- Corrupt drafts were reported as corrupt and backed up rather than discarded. The draft survived a refused storage write.
- The baseline comparison showed exactly the number of changes the engine computed (8, 13 and 13).
- Grid interaction (commit one cell, arrow navigation) and the Form Test dock stayed nearly flat across sizes. Both work on one form at a time: 20, 34 and 50 rows.

### Where cost grows with study size

- **Typing in the designer.** The longest input event while typing a label grew from 96 ms (small) to 216 ms (typical) and 640 ms (stress). Selecting a field on the stress study took a 565 ms long task. The engine edit itself takes under 1 ms, so the cost is the re-render. On stress, the study spine holds 72,824 of the page's 79,947 DOM nodes (91%), because it renders every visit-form assignment (1,408). A CPU profile of three stress keystrokes (exploratory, not part of the benchmark) attributed the main-thread time to the react-dom chunk and to native style and layout.
- **Word and PDF export.** These run on the main thread as one long task: 1.7 s (typical) and 7.0 s (stress) for Word, and 4.5 s for the slowest stress PDF run. The engine phase shows the same scale (4.3 s and 2.5 s), so the time goes to the generator rather than the UI.
- **Export previews.** Switching to the ODM-XML preview on stress blocked for 1.7 s. The preview renders the whole document as text in a `<pre>`.
- **Baseline comparison.** Opening it on stress ran a 1.2 s long task.
- **Baseline storage.** This is a capacity limit, not a latency issue. The studio allows 50 baselines, and each one stores a full copy of the study in `localStorage` next to the draft. On this browser, writes beyond 18 typical or 3 stress snapshots were refused with `QuotaExceededError`. The draft stayed intact. The engine's `saveStudyBaseline` reports such a refusal as `status: "error"`. How the Baseline Manager presents that error was not exercised.

### Defects observed while measuring (all sizes, including the default preset)

- On Exports at 1440x900, the format tab row and the preview pane are vertically clipped inside their flex column. Pointer clicks on the ODM tab are intercepted (`odmTabPointerClickable=false` in every session), so the benchmark switches tabs with the arrow keys, which work.
- The importer labels a native Universal CRF file as "CDISC USDM JSON Graph", because its `$schema` key matches the USDM check in `detectAndParseStudyFile`. The study still imports intact.

## Recommendations

Each item below has an acceptance check that uses this benchmark on the same machine class, compared against the numbers above. None of them sets an absolute budget.

1. **Make spine rendering cheaper**, for example by collapsing visit groups by default or virtualizing the visit-form rows, and by memoizing `StudySpine` so a label keystroke does not re-render it. Accept when the stress spine reports fewer DOM nodes than typical does today (11,732), and when the longest input event while typing on stress falls to typical's current value (216 ms) or below.
2. **Stop committing every keystroke into the study and the undo history.** Keep label edits in local input state and commit on pause or blur, as one history entry. Accept when "type 7 characters" on stress shows no long task over 200 ms.
3. **Move Word and PDF generation off the main thread** into a Web Worker. The chunk-cycle invariant in AGENTS.md §21 applies: the worker must import the generator, not the modal. Accept when the stress export step reports no long task over 200 ms while the download is produced.
4. **Bound the export preview**: render the first N lines, with the full content still available through Download and Copy. Accept when switching to ODM-XML on stress reports no long task over 200 ms.
5. **Move baseline snapshots out of `localStorage`**, to IndexedDB or to compressed or delta-encoded records, and show quota refusals in the Baseline Manager. Accept when the headroom step reports 50 of 50 for stress and a refused write is visible to the author.
6. **Fix the two defects above.** Accept when `odmTabPointerClickable` reports true, and when a `.crf.json` file is labelled Universal CRF.

## Not measured, and real-device follow-up

These are not covered by this report and must not be read as passing.

- **Real devices and other engines.** Only headless desktop Chromium was used. Safari, Firefox, iOS and Android, touch input, the "Largest" font setting, and real mobile CPUs were not measured. The stress numbers above suggest that low-end mobile hardware needs its own run before the stress study is described as usable on a phone.
- **Mobile and tablet viewports, throttling and accessibility.** No narrow viewport was tested, no CPU or network throttling was applied, and axe was not run at stress size. The existing `__tests__/e2e/accessibility.spec.ts` and `crf-mobile-layout.spec.ts` cover the default preset only.
- **Saved-scenario UI.** On `main`, saved scenarios have no UI that runs them, so `runScenariosForForm` is measured in the engine phase only. The browser scenario step is the Form Test dock.
- **Long sessions and leaks.** Each session ran about 25 interactions. Heap growth over hours of editing, and the 20-entry undo history under sustained typing, were not measured.
- **Quiet-machine numbers.** The machine was shared, with a load average of about 10 on 4 CPUs. Treat the absolute browser latencies as an upper bound and compare runs relatively.
