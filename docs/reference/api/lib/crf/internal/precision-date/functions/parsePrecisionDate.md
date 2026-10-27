[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/precision-date](../README.md) / parsePrecisionDate

# Function: parsePrecisionDate()

> **parsePrecisionDate**(`raw`): [`ParsedPrecisionDate`](../interfaces/ParsedPrecisionDate.md)

Parses an ISO 8601 date, partial date, or null flavor into structured parts.
Supported patterns:
- YYYY-MM-DD (Full date: e.g. 2026-08-19)
- YYYY-MM-UNK / YYYY-MM (Unknown day: e.g. 2026-08-UNK, 2026-08)
- YYYY-UNK-UNK / YYYY (Unknown month & day: e.g. 2026-UNK-UNK, 2026)
- CDISC Null Flavor (e.g. ND, NA, UNK)

## Parameters

### raw

`string` \| `null` \| `undefined`

## Returns

[`ParsedPrecisionDate`](../interfaces/ParsedPrecisionDate.md)
