[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / getPowerUpRefusal

# Function: getPowerUpRefusal()

> **getPowerUpRefusal**(`inventory`, `type`, `playing`, `activeSubject`): [`PowerUpRefusal`](../type-aliases/PowerUpRefusal.md) \| `null`

Why a lifeline cannot fire, or `null` when it can: it must be fully
charged and the shift running, and Auto-Clean and Fast-Track need an open
dossier with at least one flagged field, so their charge is never spent on
a CRF they cannot change (#1673).

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

[`PowerUpRefusal`](../type-aliases/PowerUpRefusal.md) \| `null`

The reason it cannot fire, or null.
