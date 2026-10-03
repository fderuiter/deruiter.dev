[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/debt](../README.md) / resolvePartialDate

# Function: resolvePartialDate()

> **resolvePartialDate**(`value`, `policy`): [`PartialDateOutcome`](../interfaces/PartialDateOutcome.md)

Resolves an ISO date or partial date. "YYYY-MM" kept as is is honest
uncertainty; imputing day 01 fabricates log2(days in month) bits.

## Parameters

### value

`string`

### policy

`"preserve"` \| `"impute-day"`

## Returns

[`PartialDateOutcome`](../interfaces/PartialDateOutcome.md)
