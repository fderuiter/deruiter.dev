[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/chips](../README.md) / regexSplit

# Function: regexSplit()

> **regexSplit**(`text`): [`RegexSplitResult`](../interfaces/RegexSplitResult.md)

RegexSplit: matches ^(\d{2,3})/(\d{2,3}) as the protocol's primary
reading. The rest of the text, including any repeat reading, goes to
unmatched; it is never silently dropped.

## Parameters

### text

`string`

## Returns

[`RegexSplitResult`](../interfaces/RegexSplitResult.md)
