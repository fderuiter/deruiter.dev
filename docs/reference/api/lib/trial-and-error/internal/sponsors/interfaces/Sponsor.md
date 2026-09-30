[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/sponsors](../README.md) / Sponsor

# Interface: Sponsor

A sponsor, as modifiers the run reducer knows how to apply.

## Properties

### cardChips

> **cardChips**: readonly [`CardChipBonus`](CardChipBonus.md)[]

The deck's weighting: extra Chips for the cards the client favours.

***

### description

> **description**: `string`

Who the client is, in one line.

***

### handSizeBonus

> **handSizeBonus**: `number`

Cards added to every Blind's hand size.

***

### id

> **id**: `"VIRTUAL_BIOTECH"` \| `"ONCOLOGY_PHARMA"` \| `"CARDIO_MEGA_TRIAL"` \| `"RARE_DISEASE_BIOTECH"`

***

### name

> **name**: `string`

***

### quotaFactor

> **quotaFactor**: `number`

Every Blind's quota is multiplied by this, rounded up to the next 100.

***

### startingBudget

> **startingBudget**: `number`

The study budget the run starts with, in $k.

***

### startingHandLevels

> **startingHandLevels**: `Partial`\<`Record`\<[`HandType`](../../../types/type-aliases/HandType.md), `number`\>\>

Hand levels above 1 the run starts with.

***

### startingRelicId

> **startingRelicId**: `string` \| `null`

A shop relic the run starts with in its rack, by id.

***

### twist

> **twist**: `string` \| `null`

The rule twist in one line, or null for none.
