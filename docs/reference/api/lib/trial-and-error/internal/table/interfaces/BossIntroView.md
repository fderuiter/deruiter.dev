[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/table](../README.md) / BossIntroView

# Interface: BossIntroView

The intro card for a Boss Blind (#1083): the boss, its debuff line, the
quota and CPU, and the stages of a staged encounter. Built from the
scenario's own data, so every Boss shows its own debuff.

## Properties

### bossName

> **bossName**: `string`

The boss debuff's name, e.g. "Safety Set Only".

***

### csrSlots

> **csrSlots**: `string`[]

CSR Lock's sequence slot labels, left to right; empty otherwise.

***

### debuff

> **debuff**: `string`

What the debuff does, in one line.

***

### dueHours

> **dueHours**: `number` \| `null`

Hours until an FDA response is due, or null without a clock.

***

### questions

> **questions**: `string`[]

An FDA Information Request's questions, in order; empty otherwise.

***

### quota

> **quota**: `number`

***

### stages

> **stages**: `Pick`\<\{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}, `"name"` \| `"quota"` \| `"session"`\>[]

The encounter's stages in order; empty for an unstaged Boss.

***

### startingCpu

> **startingCpu**: `number`

***

### title

> **title**: `string`

The Blind's title, e.g. "Dose Escalation Committee".
