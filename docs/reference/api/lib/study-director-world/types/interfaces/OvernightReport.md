[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director-world/types](../README.md) / OvernightReport

# Interface: OvernightReport

What happened while the player was home, from what they could know.

## Properties

### complete

> **complete**: `boolean`

True when the study finished overnight.

***

### day

> **day**: `number`

***

### lines

> **lines**: [`OvernightLine`](OvernightLine.md)[]

***

### newPhase

> **newPhase**: `"protocol"` \| `"startup"` \| `"conduct"` \| `"cleaning"` \| `"analysis"` \| `"reporting"` \| `"closeout"` \| `null`

Set when the study moved into a new phase overnight.

***

### wrapUp?

> `optional` **wrapUp?**: [`OvernightLine`](OvernightLine.md)[]

How the day just ended went, from the evening wrap-up (#1837).
