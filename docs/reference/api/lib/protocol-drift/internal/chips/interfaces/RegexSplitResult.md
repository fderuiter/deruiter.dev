[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/chips](../README.md) / RegexSplitResult

# Interface: RegexSplitResult

Result of RegexSplit on a free-text blood pressure entry.

## Properties

### dbp

> **dbp**: `number` \| `null`

***

### readings

> **readings**: `object`[]

Every SBP/DBP reading found in the text.

#### dbp

> **dbp**: `number`

#### sbp

> **sbp**: `number`

***

### sbp

> **sbp**: `number` \| `null`

***

### unmatched

> **unmatched**: `string`

Text after the primary reading; empty when nothing remains.
