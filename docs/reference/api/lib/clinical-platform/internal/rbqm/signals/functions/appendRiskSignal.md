[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/rbqm/signals](../README.md) / appendRiskSignal

# Function: appendRiskSignal()

> **appendRiskSignal**(`log`, `entry`): readonly [`RiskSignalLogEntry`](../../../../types/rbqm/interfaces/RiskSignalLogEntry.md)[]

Appends one entry to a risk signal log.

## Parameters

### log

readonly [`RiskSignalLogEntry`](../../../../types/rbqm/interfaces/RiskSignalLogEntry.md)[]

The log so far; it is not changed.

### entry

[`RiskSignalLogInput`](../type-aliases/RiskSignalLogInput.md)

The new entry, without its sequence number.

## Returns

readonly [`RiskSignalLogEntry`](../../../../types/rbqm/interfaces/RiskSignalLogEntry.md)[]

A new, frozen log with the entry at the end.

## Throws

Error when the entry does not follow from the signal's state.
