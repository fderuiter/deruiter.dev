[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/library-upgrade](../README.md) / applyLibraryUpgrade

# Function: applyLibraryUpgrade()

> **applyLibraryUpgrade**(`study`, `preview`, `entries`, `resolutions`, `now?`): [`ApplyLibraryUpgradeResult`](../type-aliases/ApplyLibraryUpgradeResult.md)

Applies a previewed upgrade, returning a new study. The study passed in is
never mutated, so the caller can keep it as the single undo step.

Every conflict in the preview needs an explicit entry in `resolutions`;
`"current"` keeps the study's version and `"incoming"` takes the
library's. The upgrade is refused when the study or library changed since
the preview, so what is applied is always what was shown.

## Parameters

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

### preview

[`LibraryUpgradePreview`](../interfaces/LibraryUpgradePreview.md)

### entries

[`PersonalLibraryEntry`](../../personal-library/interfaces/PersonalLibraryEntry.md)[]

### resolutions

`Record`\<`string`, [`LibraryConflictChoice`](../type-aliases/LibraryConflictChoice.md)\>

### now?

`Date`

## Returns

[`ApplyLibraryUpgradeResult`](../type-aliases/ApplyLibraryUpgradeResult.md)
