[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / canActivatePowerUp

# Function: canActivatePowerUp()

> **canActivatePowerUp**(`inventory`, `type`, `playing`, `activeSubject`): `boolean`

Whether a lifeline can fire. See `getPowerUpRefusal` for the rules.

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

### activeSubject

`Pick`\<[`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md), `"observations"`\> \| `null`

The open dossier, if any.

## Returns

`boolean`

True when the lifeline can fire.
