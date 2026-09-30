[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/stakes](../README.md) / StakeModifiers

# Interface: StakeModifiers

Everything a stake can change, folded from its rules.

## Properties

### actQuotaGrowth

> **actQuotaGrowth**: `number`

Each act's quotas are multiplied by this once more than the last's.

***

### redlinePenaltyFactor

> **redlinePenaltyFactor**: `number`

What every SAP rule's redline Mult penalty is multiplied by.

***

### relicSlotLocked

> **relicSlotLocked**: `boolean`

Whether one relic slot is locked each act, drawn from the seeded PRNG.

***

### shopSurcharge

> **shopSurcharge**: `number`

$k added to every shop price: single items, packs and rerolls.

***

### smallBlindPays

> **smallBlindPays**: `boolean`

Whether a Small Blind's cash-out pays its sponsor milestone payment.
