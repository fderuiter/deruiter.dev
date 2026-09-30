[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/sponsor](../README.md) / applySponsorSubmissionBoost

# Function: applySponsorSubmissionBoost()

> **applySponsorSubmissionBoost**(`state`, `allClean`): [`SponsorState`](../interfaces/SponsorState.md)

Sponsors love throughput: a signed submission nudges satisfaction up. Above
`SPONSOR_BOOST_TAPER_START` the nudge shrinks, down to a quarter at 100%, so
a fast player settles in the 70s rather than parking the meter at 100%.

## Parameters

### state

[`SponsorState`](../interfaces/SponsorState.md)

### allClean

`boolean`

## Returns

[`SponsorState`](../interfaces/SponsorState.md)
