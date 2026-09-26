[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/timeline](../README.md) / TimelineContext

# Interface: TimelineContext

Everything outside the evaluation that the timeline narrates.

## Properties

### cardNames?

> `optional` **cardNames?**: `Readonly`\<`Record`\<`string`, `string`\>\>

Display names for card ids (falls back to the id).

***

### relicNames?

> `optional` **relicNames?**: `Readonly`\<`Record`\<`string`, `string`\>\>

Display names for relic ids (falls back to the id).

***

### roundScoreBefore

> **roundScoreBefore**: `number`

Round score before this hand.

***

### target

> **target**: `number`

The Blind quota.

***

### zeroRuleLabels?

> `optional` **zeroRuleLabels?**: `Readonly`\<`Record`\<`string`, `string`\>\>

Short slam labels for zero-rule ids, e.g. "DENOMINATOR ERROR".
