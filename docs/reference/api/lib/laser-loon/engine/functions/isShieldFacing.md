[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/laser-loon/engine](../README.md) / isShieldFacing

# Function: isShieldFacing()

> **isShieldFacing**(`target`, `fromX`, `fromY`): `boolean`

True when the Starflake's shield arc faces a beam's origin, which turns
the beam away. The shield turns with the boss's `shieldAngle`, so it opens
and closes as it spins.

## Parameters

### target

`Pick`\<[`Target`](../../types/interfaces/Target.md), `"type"` \| `"isBoss"` \| `"x"` \| `"y"` \| `"shieldAngle"`\>

Any target; only the Starflake has a shield.

### fromX

`number`

The beam's origin x.

### fromY

`number`

The beam's origin y.

## Returns

`boolean`
