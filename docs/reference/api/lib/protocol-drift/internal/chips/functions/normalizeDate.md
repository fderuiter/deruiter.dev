[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/chips](../README.md) / normalizeDate

# Function: normalizeDate()

> **normalizeDate**(`raw`, `dateFormat`): [`DateNormalization`](../type-aliases/DateNormalization.md)

DateLocaleNormalizer: resolves DD/MM/YYYY or MM/DD/YYYY against the site's
verified profile and accepts ISO dates and partial dates (YYYY-MM, YYYY,
MM/YYYY). Anything else is unparseable.

## Parameters

### raw

`string`

### dateFormat

`"MM/DD/YYYY"` \| `"DD/MM/YYYY"`

## Returns

[`DateNormalization`](../type-aliases/DateNormalization.md)
