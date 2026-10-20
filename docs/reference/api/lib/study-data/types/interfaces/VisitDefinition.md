[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / VisitDefinition

# Interface: VisitDefinition

One planned visit (one SDTM `VISITNUM`), from a USDM encounter and its timing.

## Properties

### epochId

> `readonly` **epochId**: `string`

Epoch the visit belongs to.

***

### id

> `readonly` **id**: `string`

USDM encounter id.

***

### name

> `readonly` **name**: `string`

Visit name (`VISIT`), for example `WEEK 12`.

***

### targetDay

> `readonly` **targetDay**: `number`

Planned study day (`VISITDY`). There is no Day 0.

***

### visitNum

> `readonly` **visitNum**: `number`

Visit number (`VISITNUM`), one-based in schedule order.

***

### windowAfter

> `readonly` **windowAfter**: `number`

Days the visit may fall after `targetDay`.

***

### windowBefore

> `readonly` **windowBefore**: `number`

Days the visit may fall before `targetDay`.
