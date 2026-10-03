[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/library-upgrade](../README.md) / PreviewLibraryUpgradeResult

# Type Alias: PreviewLibraryUpgradeResult

> **PreviewLibraryUpgradeResult** = \{ `preview`: [`LibraryUpgradePreview`](../interfaces/LibraryUpgradePreview.md); `status`: `"ready"`; \} \| \{ `status`: `"use_missing"`; \} \| \{ `message`: `string`; `status`: `Exclude`\<[`LibraryUpgradeStatus`](LibraryUpgradeStatus.md), `"available"`\>; \}
