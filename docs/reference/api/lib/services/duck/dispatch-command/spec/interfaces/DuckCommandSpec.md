[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/services/duck/dispatch-command/spec](../README.md) / DuckCommandSpec

# Interface: DuckCommandSpec

## Methods

### execute()

> **execute**(`input`): [`DuckCommandResult`](../type-aliases/DuckCommandResult.md)

#### Parameters

##### input

\{ `state`: [`WorkingWithDuckState`](../../../../../working-with-duck-engine/interfaces/WorkingWithDuckState.md); `trick`: `"SIT"` \| `"HIGH_FIVE"` \| `"DROP_IT"` \| `"SPIN"`; `type`: `"trick"`; \} \| \{ `accessory`: `"none"` \| `"bucket-hat"` \| `"bowtie"` \| `"bandana"` \| `"rain-boots"` \| `"graduation-hat"` \| `"duck-costume"` \| `"witch-hat"` \| `"vampire-cape"`; `state`: [`WorkingWithDuckState`](../../../../../working-with-duck-engine/interfaces/WorkingWithDuckState.md); `type`: `"accessory"`; \} \| \{ `state`: [`WorkingWithDuckState`](../../../../../working-with-duck-engine/interfaces/WorkingWithDuckState.md); `type`: `"treat"`; \} \| \{ `state`: [`WorkingWithDuckState`](../../../../../working-with-duck-engine/interfaces/WorkingWithDuckState.md); `type`: `"pet"`; `x`: `number`; `y`: `number`; \} \| \{ `state`: [`WorkingWithDuckState`](../../../../../working-with-duck-engine/interfaces/WorkingWithDuckState.md); `targetX`: `number`; `targetY`: `number`; `type`: `"throw_ball"`; \} \| \{ `state`: [`WorkingWithDuckState`](../../../../../working-with-duck-engine/interfaces/WorkingWithDuckState.md); `station`: `"water"` \| `"food"` \| `"bed"` \| `"bath"`; `type`: `"station"`; \} \| \{ `state`: [`WorkingWithDuckState`](../../../../../working-with-duck-engine/interfaces/WorkingWithDuckState.md); `type`: `"advance_level"`; \}

#### Returns

[`DuckCommandResult`](../type-aliases/DuckCommandResult.md)
