[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/relics](../README.md) / RelicCard

# Interface: RelicCard

A scored card, as the relic triggers see it.

## Properties

### cancelled

> **cancelled**: `boolean`

Its score was cancelled (stale, blocked or debuffed): nothing retriggers.

***

### cardType

> **cardType**: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`

***

### chips

> **chips**: `number`

***

### id

> **id**: `string`

***

### mult

> **mult**: `number`

***

### population

> **population**: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`

***

### qcPassed

> **qcPassed**: `boolean`

Stamped QC ✓: every cell reviewed, no open redline.
