[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/metaprogression](../README.md) / recordCyberdeckMilestone

# Function: recordCyberdeckMilestone()

> **recordCyberdeckMilestone**(`profile`, `milestone`): `object`

Records a milestone, unlocking every class it opens.

## Parameters

### profile

[`CyberdeckProfile`](../../types/interfaces/CyberdeckProfile.md)

The profile before the milestone.

### milestone

[`CyberdeckMilestone`](../type-aliases/CyberdeckMilestone.md)

What the run achieved.

## Returns

`object`

The profile with the classes added (the input is not changed) and
the classes this call newly unlocked.

### profile

> **profile**: [`CyberdeckProfile`](../../types/interfaces/CyberdeckProfile.md)

### unlocked

> **unlocked**: [`CyberdeckClassId`](../../types/type-aliases/CyberdeckClassId.md)[]
