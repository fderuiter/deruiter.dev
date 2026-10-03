[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/study-omnibar](../README.md) / groupOmnibarResults

# Function: groupOmnibarResults()

> **groupOmnibarResults**(`results`, `perCategoryLimit?`): [`OmnibarResultGroup`](../interfaces/OmnibarResultGroup.md)[]

Groups ranked results by category. Groups are ordered by their best match
(falling back to [OMNIBAR\_CATEGORY\_ORDER](../variables/OMNIBAR_CATEGORY_ORDER.md)), and each group keeps at
most `perCategoryLimit` rows, reporting the rest as `hiddenCount`.

## Parameters

### results

readonly [`OmnibarSearchResult`](../interfaces/OmnibarSearchResult.md)[]

Output of [searchStudyOmnibar](searchStudyOmnibar.md).

### perCategoryLimit?

`number` = `Number.POSITIVE_INFINITY`

Maximum rows per group.

## Returns

[`OmnibarResultGroup`](../interfaces/OmnibarResultGroup.md)[]

Non-empty groups in display order.
