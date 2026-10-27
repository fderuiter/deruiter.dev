[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/personal-library](../README.md) / previewLibraryInsertion

# Function: previewLibraryInsertion()

> **previewLibraryInsertion**(`entry`, `study`): [`LibraryInsertionPreview`](../interfaces/LibraryInsertionPreview.md)

Describes what inserting an entry into a study would do, before anything is
committed: how much content arrives, and which names or ids collide.

Collisions are not errors. They are resolved by remapping at insertion time,
and are surfaced here so the author sees the remapping in advance.

## Parameters

### entry

[`PersonalLibraryEntry`](../interfaces/PersonalLibraryEntry.md)

### study

[`StudyProtocol`](../../../types/interfaces/StudyProtocol.md)

## Returns

[`LibraryInsertionPreview`](../interfaces/LibraryInsertionPreview.md)
