[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-telemetry-buffer](../README.md) / exportTelemetryToFit

# Function: exportTelemetryToFit()

> **exportTelemetryToFit**(`samples`): `Uint8Array`

Converts recorded telemetry samples into a structured Garmin FIT binary file (Uint8Array).

Structure:
- 14-byte Header (length, protocol, profile, data size, '.FIT', header CRC)
- File ID Message (Definition + Data): file_id (type 4 = activity, manufacturer 1 = garmin)
- Record Message Definition (Msg #20: record)
- Record Data Messages for each sample (timestamp, heart_rate, distance, battery, temperature/stress)
- 2-byte File CRC-16

## Parameters

### samples

[`TelemetrySample`](../interfaces/TelemetrySample.md)[]

## Returns

`Uint8Array`
