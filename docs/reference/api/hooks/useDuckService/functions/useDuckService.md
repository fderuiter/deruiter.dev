[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useDuckService](../README.md) / useDuckService

# Function: useDuckService()

> **useDuckService**(): `object`

Custom React hook providing access to Working With Duck domain service operations.
Wraps DuckCommandHandler and InteractHazardHandler with Zod input validation
and zero-exception ServiceResult error handling.

## Returns

`object`

### dispatchCommand

> **dispatchCommand**: (`input`) => [`DuckCommandResult`](../../../lib/services/duck/dispatch-command/spec/type-aliases/DuckCommandResult.md)

#### Parameters

##### input

\{ `state`: [`WorkingWithDuckState`](../../../lib/working-with-duck-engine/interfaces/WorkingWithDuckState.md); `trick`: `"SIT"` \| `"HIGH_FIVE"` \| `"DROP_IT"` \| `"SPIN"`; `type`: `"trick"`; \} \| \{ `accessory`: `"none"` \| `"bucket-hat"` \| `"bowtie"` \| `"bandana"` \| `"rain-boots"` \| `"graduation-hat"` \| `"duck-costume"` \| `"witch-hat"` \| `"vampire-cape"`; `state`: [`WorkingWithDuckState`](../../../lib/working-with-duck-engine/interfaces/WorkingWithDuckState.md); `type`: `"accessory"`; \} \| \{ `state`: [`WorkingWithDuckState`](../../../lib/working-with-duck-engine/interfaces/WorkingWithDuckState.md); `type`: `"treat"`; \} \| \{ `state`: [`WorkingWithDuckState`](../../../lib/working-with-duck-engine/interfaces/WorkingWithDuckState.md); `type`: `"pet"`; `x`: `number`; `y`: `number`; \} \| \{ `state`: [`WorkingWithDuckState`](../../../lib/working-with-duck-engine/interfaces/WorkingWithDuckState.md); `targetX`: `number`; `targetY`: `number`; `type`: `"throw_ball"`; \} \| \{ `state`: [`WorkingWithDuckState`](../../../lib/working-with-duck-engine/interfaces/WorkingWithDuckState.md); `station`: `"water"` \| `"food"` \| `"bed"` \| `"bath"`; `type`: `"station"`; \} \| \{ `state`: [`WorkingWithDuckState`](../../../lib/working-with-duck-engine/interfaces/WorkingWithDuckState.md); `type`: `"advance_level"`; \}

#### Returns

[`DuckCommandResult`](../../../lib/services/duck/dispatch-command/spec/type-aliases/DuckCommandResult.md)

### interactHazard

> **interactHazard**: (`input`) => [`InteractHazardResult`](../../../lib/services/duck/interact-hazard/spec/type-aliases/InteractHazardResult.md)

#### Parameters

##### input

###### action

`"distract_with_squeaky"` \| `"distract_with_kong"` \| `"fix_hazard"` = `...`

###### hazardId?

`string` = `...`

###### state

[`WorkingWithDuckState`](../../../lib/working-with-duck-engine/interfaces/WorkingWithDuckState.md) = `...`

###### x?

`number` = `...`

###### y?

`number` = `...`

#### Returns

[`InteractHazardResult`](../../../lib/services/duck/interact-hazard/spec/type-aliases/InteractHazardResult.md)
