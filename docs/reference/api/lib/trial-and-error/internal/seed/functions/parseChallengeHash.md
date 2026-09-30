[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/seed](../README.md) / parseChallengeHash

# Function: parseChallengeHash()

> **parseChallengeHash**(`hash`): [`Challenge`](../interfaces/Challenge.md) \| `null`

The challenge in a URL hash, or null when it names no valid seed. Unknown
parameters are ignored, so later links can add more. A `daily` date is
kept only when the seed really is that day's Daily Protocol, so a link
cannot pass another seed off as one.

`sponsor` must be a sponsor id exactly as written and `stake` a single
digit from 1 to 6; anything else falls back to the default, as does either
one on a Daily Protocol link. Only choices other than the defaults are set.

## Parameters

### hash

`string`

## Returns

[`Challenge`](../interfaces/Challenge.md) \| `null`
