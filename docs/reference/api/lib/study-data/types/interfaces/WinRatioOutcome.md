[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / WinRatioOutcome

# Interface: WinRatioOutcome

One subject's outcome on one component. For a time to an event,
`value` is the time to the event or to censoring and `event` says which.
For a continuous outcome it is the value; for a binary outcome 0 or 1.
`null` is a missing outcome, which ties with every other subject on that
component.

## Properties

### event?

> `readonly` `optional` **event?**: `boolean`

For a time to an event: `true` for an event, `false` for censoring.

***

### value

> `readonly` **value**: `number` \| `null`

The value or time, or `null` when missing.
