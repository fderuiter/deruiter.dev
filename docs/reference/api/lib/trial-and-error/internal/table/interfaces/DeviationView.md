[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/table](../README.md) / DeviationView

# Interface: DeviationView

A protocol deviation that has landed this Blind, as the table shows it.

## Properties

### afterHands

> **afterHands**: `number`

The hands played when it landed.

***

### flavor

> **flavor**: `string`

***

### fresh

> **fresh**: `boolean`

It landed after the latest hand, so the event card is showing.

***

### name

> **name**: `string`

***

### populations

> **populations**: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]

***

### snapshot

> **snapshot**: `object`

The snapshot version it produced.

#### capturedAt

> **capturedAt**: `string`

#### id

> **id**: `string` = `identifier`

#### version

> **version**: `number`

***

### staled

> **staled**: `string`[]

The outputs in hand it staled, by name, in hand order.

***

### subjectId

> **subjectId**: `string`

The subject it moved and the populations it changed.
