[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/bag](../README.md) / startLoadout

# Function: startLoadout()

> **startLoadout**(`state`, `packed`): [`GameEngineState`](../../engine/interfaces/GameEngineState.md)

A workout's start state with the packed items on it: a power-up sets the
tier now, and the rest wait in the loadout for [stepLoadout](stepLoadout.md).

## Parameters

### state

[`GameEngineState`](../../engine/interfaces/GameEngineState.md)

### packed

readonly [`GearItem`](../../plan/type-aliases/GearItem.md)[]

## Returns

[`GameEngineState`](../../engine/interfaces/GameEngineState.md)
