[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/table](../README.md) / TableEvent

# Interface: TableEvent

The most recent Card Table outcome, phrased for a polite announcement.

## Properties

### kind

> **kind**: `"RESET"` \| `"STRUCTURAL_QC"` \| `"INSPECTED"` \| `"CORRECTED"` \| `"PLAYED"` \| `"DISCARDED"` \| `"REFUSED"` \| `"SHOP"` \| `"SELECTED"` \| `"DESELECTED"` \| `"INSPECT_OPENED"` \| `"INSPECT_CLOSED"` \| `"MOVED"` \| `"BLIND_STARTED"` \| `"ACT_STARTED"` \| `"RUN_CONTINUED"` \| `"RUN_ENDED"` \| `"RECOMPILED"` \| `"ALLOCATED"` \| `"SEALED"` \| `"SOLD"` \| `"LEVELED_UP"` \| `"SAP_AMENDED"` \| `"CRISIS_RESOLVED"` \| `"TRACED"` \| `"UNBLINDED"` \| `"SESSION_CHANGED"` \| `"RELIC_CLAIMED"` \| `"AMENDED"` \| `"CASHED_OUT"`

***

### levelUp?

> `optional` **levelUp?**: [`LevelUp`](LevelUp.md)

On LEVELED_UP: the hand that levelled and its base before and after.

***

### message

> **message**: `string`

***

### sequence

> **sequence**: `number`

Increments on every event so repeated messages are still announced.
