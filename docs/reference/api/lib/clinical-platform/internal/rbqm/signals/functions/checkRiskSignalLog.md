[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/rbqm/signals](../README.md) / checkRiskSignalLog

# Function: checkRiskSignalLog()

> **checkRiskSignalLog**(`log`): [`RiskSignalLogFinding`](../../../../types/interfaces/RiskSignalLogFinding.md)[]

Checks a risk signal log, for example one read back from storage, against
the rules `appendRiskSignal` enforces.

## Parameters

### log

readonly [`RiskSignalLogEntry`](../../../../types/interfaces/RiskSignalLogEntry.md)[]

The log to check.

## Returns

[`RiskSignalLogFinding`](../../../../types/interfaces/RiskSignalLogFinding.md)[]

One finding per entry that breaks a rule; empty when the log is sound.
