[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-telemetry](../README.md) / TelemetryRecorder

# Class: TelemetryRecorder

Samples a run once per [TELEMETRY\_INTERVAL\_MS](../variables/TELEMETRY_INTERVAL_MS.md) of simulated time.
Mutable on purpose: it lives in a ref beside the animation loop and never
triggers a render.

## Constructors

### Constructor

> **new TelemetryRecorder**(): `TelemetryRecorder`

#### Returns

`TelemetryRecorder`

## Accessors

### count

#### Get Signature

> **get** **count**(): `number`

Number of stored samples.

##### Returns

`number`

## Methods

### advance()

> **advance**(`state`, `deltaMs`): `boolean`

Advances the simulated clock by `deltaMs` and records a sample for each
interval boundary crossed. Returns true when a sample was added.

#### Parameters

##### state

[`GameEngineState`](../../garmin-engine/interfaces/GameEngineState.md)

##### deltaMs

`number`

#### Returns

`boolean`

***

### finish()

> **finish**(`state`): `boolean`

Records the closing sample of a run at the exact elapsed time, unless a
sample already sits there. Returns true when one was added.

#### Parameters

##### state

[`GameEngineState`](../../garmin-engine/interfaces/GameEngineState.md)

#### Returns

`boolean`

***

### reset()

> **reset**(): `void`

Forgets every sample and restarts the clock.

#### Returns

`void`

***

### samples()

> **samples**(): [`TelemetrySample`](../interfaces/TelemetrySample.md)[]

A copy of the stored samples, oldest first.

#### Returns

[`TelemetrySample`](../interfaces/TelemetrySample.md)[]
