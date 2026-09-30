[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / canActivatePowerUp

# Function: canActivatePowerUp()

> **canActivatePowerUp**(`inventory`, `type`, `playing`, `hasActiveSubject`): `boolean`

Whether a lifeline can fire: it is fully charged, the shift is running, and
the lifelines that act on the open dossier have one to act on.

## Parameters

### inventory

[`PowerUpInventory`](../../types/type-aliases/PowerUpInventory.md)

The lifeline inventory.

### type

[`PowerUpType`](../../types/type-aliases/PowerUpType.md)

The lifeline to fire.

### playing

`boolean`

Whether the shift is running.

### hasActiveSubject

`boolean`

Whether a dossier is open.

## Returns

`boolean`

True when the lifeline can fire.
