[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/analysis](../README.md) / snapshotHandoff

# Function: snapshotHandoff()

> **snapshotHandoff**(`records`): readonly [`SDTMVitalSignRecord`](../../../types/interfaces/SDTMVitalSignRecord.md)[]

SnapshotHandoff: copies the current (non-superseded) SDTM VS rows and
deep-freezes the copy, so nothing in the Analysis Lane can mutate the
tabulation ledger.

## Parameters

### records

readonly [`SDTMVitalSignRecord`](../../../types/interfaces/SDTMVitalSignRecord.md)[]

## Returns

readonly [`SDTMVitalSignRecord`](../../../types/interfaces/SDTMVitalSignRecord.md)[]
