[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/seed](../README.md) / challengeHash

# Function: challengeHash()

> **challengeHash**(`seed`, `origin`, `choice?`): `string`

The URL hash for a challenge link, e.g. `#seed=7K3M-Q9PX`, with
`&daily=2026-09-30` for a Daily Protocol run, and
`&sponsor=ONCOLOGY_PHARMA&stake=3` for a run under a sponsor or stake
other than the defaults (#950). The Daily Protocol is always played under
the defaults, so its link never carries either.

## Parameters

### seed

`string`

### origin

[`RunOrigin`](../type-aliases/RunOrigin.md)

### choice?

`Partial`\<[`RunChoice`](../../run-rules/interfaces/RunChoice.md)\> = `{}`

## Returns

`string`
