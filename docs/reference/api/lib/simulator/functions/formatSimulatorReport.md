[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/simulator](../README.md) / formatSimulatorReport

# Function: formatSimulatorReport()

> **formatSimulatorReport**(`evaluation`, `answers`, `replayUrl`): `string`

Formats a plain-text report of an evaluation for the clipboard.

## Parameters

### evaluation

[`SimulatorEvaluation`](../interfaces/SimulatorEvaluation.md)

The scored result.

### answers

readonly [`SimulatorOption`](../interfaces/SimulatorOption.md)[]

The chosen options, in order.

### replayUrl

`string`

An absolute URL that reopens this result.

## Returns

`string`

The report text.
