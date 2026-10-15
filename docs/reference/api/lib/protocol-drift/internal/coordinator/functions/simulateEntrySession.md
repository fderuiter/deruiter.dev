[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/coordinator](../README.md) / simulateEntrySession

# Function: simulateEntrySession()

> **simulateEntrySession**(`submissions`, `seed`, `transpositions?`): [`EntrySessionResult`](../interfaces/EntrySessionResult.md)

Keys a session of submissions field by field. Attention starts at 100 and
depletes by c_f; a designated numeric fixture is transposed when attention
is below 40 and either it is scripted or a seeded draw falls below p_err.
A seeded study variant passes its own designated fixtures (#2275).

## Parameters

### submissions

readonly [`SubmissionFixture`](../../../types/interfaces/SubmissionFixture.md)[]

### seed

`number`

### transpositions?

readonly `object`[] = `SCRIPTED_TRANSPOSITIONS`

## Returns

[`EntrySessionResult`](../interfaces/EntrySessionResult.md)
