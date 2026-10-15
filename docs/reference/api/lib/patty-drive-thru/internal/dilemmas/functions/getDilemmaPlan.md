[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/dilemmas](../README.md) / getDilemmaPlan

# Function: getDilemmaPlan()

> **getDilemmaPlan**(`config`): readonly [`DilemmaSlot`](../../../types/interfaces/DilemmaSlot.md)[]

The dilemmas a shift puts to the player and when, drawn from the shift's
seed alone. Up to `DILEMMAS_PER_SHIFT` of them, never the same one twice,
spread evenly through the shift with a little seeded jitter, and each early
enough that its timer runs out before close.

## Parameters

### config

`Pick`\<[`ShiftConfig`](../../../types/interfaces/ShiftConfig.md), `"seed"` \| `"durationSec"` \| `"dilemmaWindowSec"` \| `"dilemmaDeck"`\>

The shift's seed, length and answer window.

## Returns

readonly [`DilemmaSlot`](../../../types/interfaces/DilemmaSlot.md)[]
