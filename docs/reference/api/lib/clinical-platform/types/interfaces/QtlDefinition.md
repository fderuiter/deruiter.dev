[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / QtlDefinition

# Interface: QtlDefinition

A quality tolerance limit (ICH E6(R3)): a study-level limit on a
registry metric whose breach calls for the response planned in advance.

## Properties

### id

> `readonly` **id**: `string`

QTL id, for example `qtl-early-termination`.

***

### metricId

> `readonly` **metricId**: `string`

The registry metric the QTL evaluates per study.

***

### name

> `readonly` **name**: `string`

***

### rationale

> `readonly` **rationale**: `string`

What the parameter stands for, and why it matters to the study's results.

***

### response

> `readonly` **response**: `string`

The response planned before any breach.
