[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/rbqm/signals](../README.md) / riskSignalStates

# Function: riskSignalStates()

> **riskSignalStates**(`log`): `object`[]

The state of each signal in a log: its last event.

## Parameters

### log

readonly [`RiskSignalLogEntry`](../../../../types/interfaces/RiskSignalLogEntry.md)[]

A risk signal log.

## Returns

`object`[]

Each signal id with its last event, in the order signals were raised.
