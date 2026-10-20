[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/usdm-adapter](../README.md) / diffUsdmProtocols

# Function: diffUsdmProtocols()

> **diffUsdmProtocols**(`usdmAInput`, `usdmBInput`): [`UsdmDiffSummary`](../interfaces/UsdmDiffSummary.md)

Performs semantic version diffing between two USDM protocol revisions.
Identifies added, modified, or removed arms, epochs, cohorts, biomedical concepts, encounters, and activities.

## Parameters

### usdmAInput

`string` \| `Record`\<`string`, `unknown`\> \| [`UsdmV4Document`](../../usdm-v4-types/interfaces/UsdmV4Document.md) \| [`UsdmDocument`](../interfaces/UsdmDocument.md)

### usdmBInput

`string` \| `Record`\<`string`, `unknown`\> \| [`UsdmV4Document`](../../usdm-v4-types/interfaces/UsdmV4Document.md) \| [`UsdmDocument`](../interfaces/UsdmDocument.md)

## Returns

[`UsdmDiffSummary`](../interfaces/UsdmDiffSummary.md)
