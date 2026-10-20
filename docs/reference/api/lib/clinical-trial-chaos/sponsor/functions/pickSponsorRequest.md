[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/sponsor](../README.md) / pickSponsorRequest

# Function: pickSponsorRequest()

> **pickSponsorRequest**(`rand?`, `lastRequestId?`): [`SponsorRequest`](../interfaces/SponsorRequest.md)

Picks the next sponsor email, avoiding an immediate repeat. `rand` must return a value in [0, 1).

## Parameters

### rand?

() => `number`

### lastRequestId?

`string` \| `null` = `null`

## Returns

[`SponsorRequest`](../interfaces/SponsorRequest.md)
