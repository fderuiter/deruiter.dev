[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/table](../README.md) / ClockView

# Interface: ClockView

An FDA Information Request's deterministic clock (#921): hours left, what
each move costs, and whether the deadline is close. It moves only when a
move is made; nothing reads the wall clock.

## Properties

### consequence

> **consequence**: `string`

What the program may not do on hold, e.g. "proceed to Phase III".

***

### costs

> **costs**: `Record`\<[`ClockAction`](../../../types/type-aliases/ClockAction.md), `number`\>

What each move takes in hours.

***

### hold

> **hold**: `boolean`

The clock ran out with questions open: a Clinical Hold.

***

### hoursLeft

> **hoursLeft**: `number`

***

### request

> **request**: `string`

The request's name, as the Clinical Hold letter gives it (#2331).

***

### totalHours

> **totalHours**: `number`

***

### urgent

> **urgent**: `boolean`

`CLOCK_URGENT_HOURS` or fewer are left.
