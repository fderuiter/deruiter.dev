[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-telemetry](../README.md) / exportTelemetryFit

# Function: exportTelemetryFit()

> **exportTelemetryFit**(`samples`, `startUnixMs`): `Uint8Array`\<`ArrayBuffer`\>

A FIT activity file for the samples: file id, one record per sample (heart
rate and distance), then the session and activity summaries.

## Parameters

### samples

readonly [`TelemetrySample`](../interfaces/TelemetrySample.md)[]

Samples, oldest first.

### startUnixMs

`number`

Wall-clock start of the run, in milliseconds since the Unix epoch.

## Returns

`Uint8Array`\<`ArrayBuffer`\>
