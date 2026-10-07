[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-telemetry-buffer](../README.md) / TelemetryBuffer

# Class: TelemetryBuffer

In-memory ring buffer for telemetry snapshots.

## Constructors

### Constructor

> **new TelemetryBuffer**(`maxCapacity?`, `sampleIntervalMs?`): `TelemetryBuffer`

#### Parameters

##### maxCapacity?

`number` = `DEFAULT_TELEMETRY_MAX_SAMPLES`

##### sampleIntervalMs?

`number` = `DEFAULT_TELEMETRY_INTERVAL_MS`

#### Returns

`TelemetryBuffer`

## Accessors

### sampleCount

#### Get Signature

> **get** **sampleCount**(): `number`

Returns the total count of recorded telemetry samples.

##### Returns

`number`

## Methods

### clear()

> **clear**(): `void`

Resets and clears all recorded telemetry samples.

#### Returns

`void`

***

### getSamples()

> **getSamples**(): [`TelemetrySample`](../interfaces/TelemetrySample.md)[]

Returns a copy of all recorded telemetry samples in chronological order.

#### Returns

[`TelemetrySample`](../interfaces/TelemetrySample.md)[]

***

### recordSample()

> **recordSample**(`state`, `now?`, `force?`): `boolean`

Captures a telemetry snapshot if state is active and sampling interval has elapsed.

#### Parameters

##### state

[`GameEngineState`](../../garmin-engine/interfaces/GameEngineState.md)

##### now?

`number` = `...`

##### force?

`boolean` = `false`

#### Returns

`boolean`
