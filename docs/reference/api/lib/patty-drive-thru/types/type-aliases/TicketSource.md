[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/types](../README.md) / TicketSource

# Type Alias: TicketSource

> **TicketSource** = `Pick`\<[`ShiftState`](../interfaces/ShiftState.md), `"time"` \| `"orders"` \| `"pos"`\> & `object`

The parts of a shift the kitchen display reads. The config is optional and
only says whether age-locked items have unlocked (#2086).

## Type Declaration

### config?

> `readonly` `optional` **config?**: `Pick`\<[`ShiftConfig`](../interfaces/ShiftConfig.md), `"ageUnlocked"`\>
