[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/telemetry](../README.md) / collectShiftEvents

# Function: collectShiftEvents()

> **collectShiftEvents**(`config`, `history?`, `finalTime?`): [`TelemetryEvent`](../interfaces/TelemetryEvent.md)[]

Replays shift actions and steps to collect time-series events.

## Parameters

### config

[`ShiftScenarioConfig`](../../../types/interfaces/ShiftScenarioConfig.md)

### history?

readonly [`ShiftActionEntry`](../../../types/interfaces/ShiftActionEntry.md)[] = `[]`

### finalTime?

`number` = `config.durationSec`

## Returns

[`TelemetryEvent`](../interfaces/TelemetryEvent.md)[]
