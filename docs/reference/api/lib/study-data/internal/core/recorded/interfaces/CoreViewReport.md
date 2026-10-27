[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/core/recorded](../README.md) / CoreViewReport

# Interface: CoreViewReport

CORE's outcome for one recorded view, ready to show.

## Properties

### findings

> `readonly` **findings**: readonly [`CoreFinding`](CoreFinding.md)[]

Findings, most first, then by rule id.

***

### lock

> `readonly` **lock**: [`RecordedLock`](RecordedLock.md)

***

### outcomes

> `readonly` **outcomes**: `Readonly`\<`Record`\<`string`, `number`\>\>

SDTMIG rules by outcome, with the view's own statuses.

***

### ruleCount

> `readonly` **ruleCount**: `number`

***

### terminology

> `readonly` **terminology**: `object`

The terminology release the datasets cite, and the one CORE checked them
against (the newest in CORE's cache, which can lag the cited release).

#### checked

> `readonly` **checked**: `string`

#### cited

> `readonly` **cited**: `string`

***

### view

> `readonly` **view**: [`CoreView`](../type-aliases/CoreView.md)
