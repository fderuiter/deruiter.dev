[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/quality](../README.md) / DqScenario

# Interface: DqScenario

A named defect of the kind real source feeds deliver, applied to a
warehouse to show which rules catch it (#2636).

## Properties

### id

> `readonly` **id**: `string`

Stable id, for example `finance-double-load`.

***

### name

> `readonly` **name**: `string`

***

### ruleIds

> `readonly` **ruleIds**: readonly `string`[]

Rules whose failing count the defect raises, in rule order.

***

### sourceSystem

> `readonly` **sourceSystem**: `string`

Source system the defect arrives from.

***

### story

> `readonly` **story**: `string`

What went wrong at the source, in a sentence or two.
