# CRF Studio Local Draft Recovery

Scope: how CRF Studio keeps the study you are editing in browser storage, and what it cannot recover (issue [#3804](https://github.com/fderuiter/deruiter.dev/issues/3804)). The hook is `useStudyAutosave` in `hooks/useStudyAutosave.ts`, and it writes through `saveStudyDraft` from `lib/crf`.

## When the draft is written

| Situation | What happens |
| --- | --- |
| Normal editing | The latest edit is written 800 ms after you stop typing. Until storage acknowledges it, the status reads "Saving…". |
| Leaving the studio for another page on the site | The latest edit is written at once, before the editor is discarded. |
| Switching tabs, minimizing, or the browser sending `pagehide` | The latest edit is written at once. Nothing waits for the debounce or the network. |
| Storage denied, full or unavailable | The edit stays in memory while the studio is open. The status shows the failure and offers **Download draft**, which saves the latest edit as JSON. The status never says saved after a failed write. The next edit or lifecycle event tries again. |

Each write is skipped when storage already holds that revision, so repeated events do not write twice.

## Limits

- A browser or OS crash, a killed process or a power loss before one of the events above is delivered can lose the last edit. Recovery restores the last acknowledged write, not every keystroke.
- Browsers can evict local storage (private windows, storage pressure, cleared site data). A local draft is not a backup. Use **Download draft** or an export to keep a copy.
- Three states are tracked separately. Baseline-dirty means the study differs from the chosen comparison baseline. Locally-unsaved means storage has not acknowledged the latest edit. Not-exported means it differs from the last explicit export. Saving locally does not export anything.
