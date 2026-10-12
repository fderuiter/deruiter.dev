[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-body-battery](../README.md) / stepBodyBattery

# Function: stepBodyBattery()

> **stepBodyBattery**(`bb`, `input`, `grounded`, `deltaMs`): [`BodyBattery`](../interfaces/BodyBattery.md)

input: 1 sprint, 0 run, -1 brake (the engine's run input). In the air nothing changes. Hitting 0 sets bonked. Recovering to >= BONK_RECOVER_AT clears it. While bonked, a steady pace recharges like braking.

## Parameters

### bb

[`BodyBattery`](../interfaces/BodyBattery.md) \| `undefined`

### input

`0` \| `1` \| `-1` \| `undefined`

### grounded

`boolean`

### deltaMs

`number`

## Returns

[`BodyBattery`](../interfaces/BodyBattery.md)
