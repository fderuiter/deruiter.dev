[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/save](../README.md) / RunLog

# Interface: RunLog

A run as the save keeps it: where it started and every move since.

## Properties

### actId

> **actId**: `string`

The plan's id: the act played on its own, or the campaign.

***

### actions

> **actions**: [`LoggedAction`](../type-aliases/LoggedAction.md)[]

***

### origin?

> `optional` **origin?**: [`RunOrigin`](../../seed/type-aliases/RunOrigin.md)

How the seed was chosen; absent means a random run.

***

### seed

> **seed**: `string`
