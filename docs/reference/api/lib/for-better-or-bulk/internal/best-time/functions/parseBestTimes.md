[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/best-time](../README.md) / parseBestTimes

# Function: parseBestTimes()

> **parseBestTimes**(`raw`): [`BestTimes`](../../../types/type-aliases/BestTimes.md)

Reads the stored best times. Anything that is not a JSON object of finite,
in-range times is dropped: a malformed string gives no best times at all,
and a malformed entry is skipped while the others are kept.

## Parameters

### raw

`string` \| `null`

## Returns

[`BestTimes`](../../../types/type-aliases/BestTimes.md)
