[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-widget-layout](../README.md) / MetricDefinition

# Interface: MetricDefinition

## Properties

### formatReadout

> **formatReadout**: (`state`) => `string`

#### Parameters

##### state

[`GameEngineState`](../../garmin-engine/interfaces/GameEngineState.md)

#### Returns

`string`

***

### key

> **key**: [`MetricKey`](../type-aliases/MetricKey.md)

***

### label

> **label**: `string`

***

### resolveFraction

> **resolveFraction**: (`state`) => `number`

#### Parameters

##### state

[`GameEngineState`](../../garmin-engine/interfaces/GameEngineState.md)

#### Returns

`number`

***

### resolveTone

> **resolveTone**: (`state`) => `"warn"` \| `"ok"` \| `"danger"`

#### Parameters

##### state

[`GameEngineState`](../../garmin-engine/interfaces/GameEngineState.md)

#### Returns

`"warn"` \| `"ok"` \| `"danger"`

***

### resolveValue

> **resolveValue**: (`state`) => `number`

#### Parameters

##### state

[`GameEngineState`](../../garmin-engine/interfaces/GameEngineState.md)

#### Returns

`number`

***

### shortLabel

> **shortLabel**: `string`

***

### unit

> **unit**: `string`
