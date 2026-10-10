[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/telemetry](../README.md) / ShiftTelemetry

# Interface: ShiftTelemetry

What a finished shift exports: the setup, the result and what happened.

## Properties

### countsTowardScore

> `readonly` **countsTowardScore**: `boolean`

False for a practice scenario, whose score is not recorded.

***

### durationSec

> `readonly` **durationSec**: `number`

***

### events

> `readonly` **events**: readonly [`ShiftLogEntry`](../../../types/interfaces/ShiftLogEntry.md)[]

***

### outcome

> `readonly` **outcome**: [`ShiftOutcome`](../../../types/type-aliases/ShiftOutcome.md)

***

### payStub

> `readonly` **payStub**: [`PayStub`](../../../types/interfaces/PayStub.md)

***

### scenario

> `readonly` **scenario**: [`ShiftScenario`](../../../types/interfaces/ShiftScenario.md)

The scenario dials the shift set; empty for the standard shift.

***

### score

> `readonly` **score**: `number`

***

### seed

> `readonly` **seed**: `string`

***

### tallies

> `readonly` **tallies**: [`ShiftTallies`](../../../types/interfaces/ShiftTallies.md)

***

### timeWorkedSec

> `readonly` **timeWorkedSec**: `number`

***

### version

> `readonly` **version**: `1`
