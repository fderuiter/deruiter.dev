[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/foes](../README.md) / damageFoe

# Function: damageFoe()

> **damageFoe**(`foe`, `amount`): [`FoeHit`](../interfaces/FoeHit.md)

A hit from a heat bolt, a cape spin, a sliding shell or a Runner's High.
Ordinary foes are defeated; the Rep Max loses `amount` hit points and The
Wall one (#1994), and until it runs out each has a short grace before the
next hit counts.

## Parameters

### foe

[`Foe`](../interfaces/Foe.md)

### amount

`number`

## Returns

[`FoeHit`](../interfaces/FoeHit.md)
