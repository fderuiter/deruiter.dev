[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-powerups](../README.md) / canThrowBolt

# Function: canThrowBolt()

> **canThrowBolt**(`power`, `bolts`, `cooldownMs`): `boolean`

Whether a runner can throw a heat bolt now: Heat Map tier, the cooldown
spent, and fewer than [MAX\_BOLTS](../variables/MAX_BOLTS.md) on the face.

## Parameters

### power

[`PowerTier`](../type-aliases/PowerTier.md) \| `undefined`

### bolts

readonly [`Bolt`](../interfaces/Bolt.md)[] \| `undefined`

### cooldownMs

`number` \| `undefined`

## Returns

`boolean`
