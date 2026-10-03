[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/library-upgrade](../README.md) / ApplyLibraryUpgradeResult

# Type Alias: ApplyLibraryUpgradeResult

> **ApplyLibraryUpgradeResult** = \{ `record`: [`StudyLibraryUpgradeRecord`](../../types/interfaces/StudyLibraryUpgradeRecord.md); `status`: `"applied"`; `study`: [`StudyProtocol`](../../types/interfaces/StudyProtocol.md); `use`: [`StudyLibraryUse`](../../types/interfaces/StudyLibraryUse.md); \} \| \{ `status`: `"unresolved"`; `unresolvedChangeIds`: `string`[]; \} \| \{ `message`: `string`; `status`: `"stale"`; \} \| \{ `message`: `string`; `status`: `"unavailable"`; \}
