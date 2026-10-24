[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / KaplanMeierStep

# Interface: KaplanMeierStep

The product-limit estimate at one observed time: the events and
censorings at the time and the estimate just after it.

## Properties

### atRisk

> `readonly` **atRisk**: `number`

Subjects at risk at the time: those whose time is the same or later.

***

### censored

> `readonly` **censored**: `number`

Censorings at the time.

***

### events

> `readonly` **events**: `number`

Events at the time.

***

### lower

> `readonly` **lower**: `number` \| `null`

Lower 95% limit (log-log), or `null` when not estimable.

***

### standardError

> `readonly` **standardError**: `number`

Greenwood standard error of the estimate.

***

### survival

> `readonly` **survival**: `number`

The survival estimate just after the time.

***

### time

> `readonly` **time**: `number`

The time.

***

### upper

> `readonly` **upper**: `number` \| `null`

Upper 95% limit (log-log), or `null` when not estimable.
