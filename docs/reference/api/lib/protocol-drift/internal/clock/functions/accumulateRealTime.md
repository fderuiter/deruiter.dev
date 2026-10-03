[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/clock](../README.md) / accumulateRealTime

# Function: accumulateRealTime()

> **accumulateRealTime**(`carry`, `realMs`, `speed`): `object`

Converts real elapsed time into whole simulated minutes. The carry is kept
in thousandths of a minute so any split of the same real time yields the
same total minutes.

## Parameters

### carry

`number`

### realMs

`number`

### speed

[`SimSpeed`](../../../types/type-aliases/SimSpeed.md)

## Returns

`object`

### carry

> **carry**: `number`

### minutes

> **minutes**: `number`
