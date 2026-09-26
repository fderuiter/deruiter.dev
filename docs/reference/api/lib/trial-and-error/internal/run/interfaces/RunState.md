[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/run](../README.md) / RunState

# Interface: RunState

Serializable run state: the seed and draw log that make the run
replayable, which Blind of the act is being played, and that Blind's Card
Table. Contains no derived or browser data.

## Properties

### actId

> **actId**: `string`

The plan's id: the act played on its own, or the campaign.

***

### actIndex

> **actIndex**: `number`

Index into the plan's acts.

***

### blindIndex

> **blindIndex**: `number`

Index into the current act's Blinds, Small first.

***

### bossIds

> **bossIds**: (`string` \| `null`)[]

The Boss of each act reached so far, in act order: drawn from the act's
pool as its study starts, or its fixed Boss.

***

### cashOut

> **cashOut**: [`CashOutReport`](../../shop/interfaces/CashOutReport.md) \| `null`

The cleared Blind's cash-out, once the sponsor has paid it.

***

### drawIndex

> **drawIndex**: `number`

The next unused draw index.

***

### draws

> **draws**: [`RunDraw`](RunDraw.md)[]

Every seeded draw so far, in order.

***

### ended

> **ended**: `boolean`

The won run was submitted and ended; nothing follows (#1088).

***

### endless

> **endless**: `boolean`

The run went on into endless post-marketing rounds after winning (#1088).

***

### seed

> **seed**: `string`

The run seed. The same seed and the same moves replay identically.

***

### shop

> **shop**: [`ShopState`](ShopState.md) \| `null`

The shop visit after the cash-out, if the act has a shop.

***

### shopDraws

> **shopDraws**: `number`

The next unused draw index on the shop's own seeded stream.

***

### table

> **table**: [`TableState`](../../table/interfaces/TableState.md)
