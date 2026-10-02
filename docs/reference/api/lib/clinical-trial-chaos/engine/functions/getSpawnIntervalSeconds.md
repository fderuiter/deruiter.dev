[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/engine](../README.md) / getSpawnIntervalSeconds

# Function: getSpawnIntervalSeconds()

> **getSpawnIntervalSeconds**(`phase`, `queueLength`, `scale?`, `arrivalRateMultiplier?`): `number`

Seconds until the next subject spawns. An empty queue refills almost at
once and a queue with one subject left fills at twice the phase rate, so a
fast player works instead of waiting on the conveyor (#1327). `scale`
applies office modifiers to the phase rate; the empty-queue refill ignores
it.

## Parameters

### phase

[`GamePhase`](../../types/type-aliases/GamePhase.md)

### queueLength

`number`

### scale?

(`seconds`) => `number`

### arrivalRateMultiplier?

`number` = `1.0`

## Returns

`number`
