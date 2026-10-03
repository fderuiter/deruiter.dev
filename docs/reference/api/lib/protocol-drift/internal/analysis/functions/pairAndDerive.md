[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/analysis](../README.md) / pairAndDerive

# Function: pairAndDerive()

> **pairAndDerive**(`snapshot`, `options?`): [`PairAndDeriveResult`](../../../types/interfaces/PairAndDeriveResult.md)

PairAndDerive over a snapshot. Visits without any standing measurement
yield one ORTHOST NOT EVALUABLE entry; a parameter with zero or several
candidates yields a per-parameter NOT EVALUABLE entry. With joinKey
"subject" every cross-visit candidate pair is rejected as TRACE.

## Parameters

### snapshot

readonly [`SDTMVitalSignRecord`](../../../types/interfaces/SDTMVitalSignRecord.md)[]

### options?

[`PairOptions`](../interfaces/PairOptions.md) = `{}`

## Returns

[`PairAndDeriveResult`](../../../types/interfaces/PairAndDeriveResult.md)
