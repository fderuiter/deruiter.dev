[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/amendments](../README.md) / parkAuditorAtStation

# Function: parkAuditorAtStation()

> **parkAuditorAtStation**(`auditor`, `x`, `stationId`): [`AuditorState`](../../types/interfaces/AuditorState.md)

Parks the auditor at the watched station: they stand still at `x` and
inspect. A coffee break, a pause or a Form 483 in progress is left alone.

## Parameters

### auditor

[`AuditorState`](../../types/interfaces/AuditorState.md)

The auditor after this frame's patrol step.

### x

`number`

Floor position of the watched station, from 0 to 1.

### stationId

[`CDISCDomain`](../../types/type-aliases/CDISCDomain.md)

The watched station.

## Returns

[`AuditorState`](../../types/interfaces/AuditorState.md)

The parked auditor.
