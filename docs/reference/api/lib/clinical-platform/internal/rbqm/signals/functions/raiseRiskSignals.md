[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/rbqm/signals](../README.md) / raiseRiskSignals

# Function: raiseRiskSignals()

> **raiseRiskSignals**(`studyId`, `on`, `signals`): readonly [`RiskSignalLogEntry`](../../../../types/rbqm/interfaces/RiskSignalLogEntry.md)[]

Raises signals in a new log, numbered per study in the order given.

## Parameters

### studyId

`string`

The study the signals belong to.

### on

`string`

ISO 8601 date they are raised, the data cut.

### signals

readonly [`RaisedSignal`](../interfaces/RaisedSignal.md)[]

What to raise.

## Returns

readonly [`RiskSignalLogEntry`](../../../../types/rbqm/interfaces/RiskSignalLogEntry.md)[]

A new, frozen log with one `raised` entry per signal.
