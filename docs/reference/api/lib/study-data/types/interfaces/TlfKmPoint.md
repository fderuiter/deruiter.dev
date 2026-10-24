[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / TlfKmPoint

# Interface: TlfKmPoint

One plotted time of a Kaplan-Meier curve and the results it shows.

## Properties

### atRisk

> `readonly` **atRisk**: `number`

Subjects at risk at the time.

***

### censored

> `readonly` **censored**: `number`

Censorings at the time, each marked on the curve.

***

### events

> `readonly` **events**: `number`

Events at the time.

***

### limitsText

> `readonly` **limitsText**: `string`

The 95% limits as displayed, for example `(0.6197, 0.9516)`, or `NE`.

***

### lower

> `readonly` **lower**: `number` \| `null`

Lower 95% limit, or `null` when not estimable.

***

### resultIds

> `readonly` **resultIds**: readonly `string`[]

Ids of the results the point is drawn from.

***

### standardErrorText

> `readonly` **standardErrorText**: `string`

The Greenwood standard error as displayed.

***

### survival

> `readonly` **survival**: `number`

The survival estimate just after the time.

***

### survivalText

> `readonly` **survivalText**: `string`

The estimate as displayed.

***

### time

> `readonly` **time**: `number`

The time, in days; 0 is the start of the curve.

***

### upper

> `readonly` **upper**: `number` \| `null`

Upper 95% limit, or `null` when not estimable.
