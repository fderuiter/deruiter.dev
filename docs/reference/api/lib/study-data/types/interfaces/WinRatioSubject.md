[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / WinRatioSubject

# Interface: WinRatioSubject

One subject entering a win-ratio analysis.

## Properties

### group

> `readonly` **group**: `"treatment"` \| `"control"`

Which side of the comparison the subject is on.

***

### id

> `readonly` **id**: `string`

Identifier, unique within the analysis (for example USUBJID).

***

### outcomes

> `readonly` **outcomes**: readonly [`WinRatioOutcome`](WinRatioOutcome.md)[]

Outcomes, one per component, in the hierarchy's order.

***

### stratum?

> `readonly` `optional` **stratum?**: `string`

Stratum label; subjects are paired only within a stratum.
