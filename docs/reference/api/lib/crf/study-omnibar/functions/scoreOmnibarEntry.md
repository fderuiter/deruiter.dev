[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/study-omnibar](../README.md) / scoreOmnibarEntry

# Function: scoreOmnibarEntry()

> **scoreOmnibarEntry**(`query`, `entry`): `number`

Scores how well a query matches an entry: every whitespace-separated
token must match the title, detail, context or keywords, by prefix,
substring, ordered subsequence or a small edit distance. Title matches
weigh most. A leading `/` is ignored so slash commands match too.

## Parameters

### query

`string`

Raw query text.

### entry

[`OmnibarEntry`](../interfaces/OmnibarEntry.md)

The entry to score.

## Returns

`number`

0 for no match, otherwise a positive relevance score.
