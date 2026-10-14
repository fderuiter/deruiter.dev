[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/types](../README.md) / CyberdeckProfile

# Interface: CyberdeckProfile

## Properties

### classUnlockRules?

> `optional` **classUnlockRules?**: `number`

Set on profiles written once classes unlock on milestones (#2085). A save
without it predates the locks and keeps every class.

***

### firmwareUpgrades

> **firmwareUpgrades**: `object`

#### exploitRadiusTier

> **exploitRadiusTier**: `number`

#### maxRamTier

> **maxRamTier**: `number`

#### scanSpeedTier

> **scanSpeedTier**: `number`

#### startChipsTier

> **startChipsTier**: `number`

***

### highScore

> **highScore**: `number`

***

### runsCompleted

> **runsCompleted**: `number`

***

### selectedClass

> **selectedClass**: [`CyberdeckClassId`](../type-aliases/CyberdeckClassId.md)

***

### totalCrypto

> **totalCrypto**: `number`

***

### unlockedClasses

> **unlockedClasses**: [`CyberdeckClassId`](../type-aliases/CyberdeckClassId.md)[]
