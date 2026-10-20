[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/body-battery](../README.md) / adjustBodyBattery

# Function: adjustBodyBattery()

> **adjustBodyBattery**(`bb`, `amount`): [`BodyBattery`](../interfaces/BodyBattery.md)

Adds (or with a negative amount, removes) charge, clamped to 0..MAX, applying the same bonk rules.

## Parameters

### bb

[`BodyBattery`](../interfaces/BodyBattery.md) \| `undefined`

### amount

`number`

## Returns

[`BodyBattery`](../interfaces/BodyBattery.md)
