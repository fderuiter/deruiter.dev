[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/ram](../README.md) / getTacticBlock

# Function: getTacticBlock()

> **getTacticBlock**(`tactic`, `currentRam`): [`TacticBlock`](../interfaces/TacticBlock.md) \| `null`

Decide whether a tactic can be played with the RAM that is left.

At 0 GB the session has stopped, so every tactic is refused, including
the free `sorry`, until the level is reset. Above 0 GB a tactic is
refused only when its base cost is more than the RAM left.

## Parameters

### tactic

`Pick`\<[`TacticDef`](../../types/interfaces/TacticDef.md), `"name"` \| `"baseRamCost"`\>

The tactic's name and base cost.

### currentRam

`number`

RAM left, in GB.

## Returns

[`TacticBlock`](../interfaces/TacticBlock.md) \| `null`

Why the tactic is refused, or null when it can be played.
