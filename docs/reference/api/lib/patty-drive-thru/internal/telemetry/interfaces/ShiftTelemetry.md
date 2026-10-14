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

### dilemmas

> `readonly` **dilemmas**: readonly [`DilemmaChoice`](../../../types/interfaces/DilemmaChoice.md)[]

Every dilemma answered, in order (#2087).

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

### solidarity

> `readonly` **solidarity**: `number`

The hidden Solidarity value at the end of the shift (#2087).

***

### tallies

> `readonly` **tallies**: [`ShiftTallies`](../../../types/interfaces/ShiftTallies.md)

***

### timeWorkedSec

> `readonly` **timeWorkedSec**: `number`

***

### version

> `readonly` **version**: `1`
