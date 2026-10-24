[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/lineage/model](../README.md) / LineageTrace

# Interface: LineageTrace

The result of `LineageIndex.trace`.

## Properties

### adam

> `readonly` **adam**: [`LineageStep`](LineageStep.md)\<[`LineageRecord`](LineageRecord.md)\>

***

### collected

> `readonly` **collected**: [`LineageStep`](LineageStep.md)\<[`LineageRecord`](LineageRecord.md)\>

***

### origin

> `readonly` **origin**: [`LineageOrigin`](../type-aliases/LineageOrigin.md)

***

### originLevel

> `readonly` **originLevel**: [`LineageLevel`](../type-aliases/LineageLevel.md)

The level the trace starts at. Levels before it are upstream, after it downstream.

***

### populationRows?

> `readonly` `optional` **populationRows?**: `number`

For a result start: the ADSL rows of the result's population (the
denominator), which are counted here rather than listed.

***

### results

> `readonly` **results**: [`LineageStep`](LineageStep.md)\<[`LineageResult`](LineageResult.md)\>

***

### schedule

> `readonly` **schedule**: [`LineageStep`](LineageStep.md)\<[`LineageScheduleEntry`](LineageScheduleEntry.md)\>

***

### sdtm

> `readonly` **sdtm**: [`LineageStep`](LineageStep.md)\<[`LineageRecord`](LineageRecord.md)\>

***

### title

> `readonly` **title**: `string`

What the trace starts from, in words.
