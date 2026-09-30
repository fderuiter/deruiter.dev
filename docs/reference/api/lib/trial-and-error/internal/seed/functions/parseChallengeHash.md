[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/seed](../README.md) / parseChallengeHash

# Function: parseChallengeHash()

> **parseChallengeHash**(`hash`): [`Challenge`](../interfaces/Challenge.md) \| `null`

The challenge in a URL hash, or null when it names no valid seed. Unknown
parameters are ignored, so later links can add more. A `daily` date is
kept only when the seed really is that day's Daily Protocol, so a link
cannot pass another seed off as one.

## Parameters

### hash

`string`

## Returns

[`Challenge`](../interfaces/Challenge.md) \| `null`
