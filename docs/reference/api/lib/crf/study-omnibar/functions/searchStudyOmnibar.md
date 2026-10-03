[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/study-omnibar](../README.md) / searchStudyOmnibar

# Function: searchStudyOmnibar()

> **searchStudyOmnibar**(`entries`, `query`, `category?`): [`OmnibarSearchResult`](../interfaces/OmnibarSearchResult.md)[]

Searches the omnibar index, ranked by [scoreOmnibarEntry](scoreOmnibarEntry.md). An empty
query returns every entry (optionally of one category) in index order.

## Parameters

### entries

readonly [`OmnibarEntry`](../interfaces/OmnibarEntry.md)[]

Index from [buildStudyOmnibarIndex](buildStudyOmnibarIndex.md).

### query

`string`

Raw query text.

### category?

[`OmnibarCategory`](../type-aliases/OmnibarCategory.md)

Restrict results to one category.

## Returns

[`OmnibarSearchResult`](../interfaces/OmnibarSearchResult.md)[]

Matching entries, best first.
