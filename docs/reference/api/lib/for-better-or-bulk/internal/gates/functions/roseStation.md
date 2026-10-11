[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/gates](../README.md) / roseStation

# Function: roseStation()

> **roseStation**(`state`): [`StationKind`](../../../types/type-aliases/StationKind.md) \| `null`

Where roses should go now: ARRANGE when an arrangement is still wanted, or
PETALS when the aisle is planned and open, whichever has a free station.
Null when neither wants roses or both are busy.

## Parameters

### state

[`GameState`](../../../types/interfaces/GameState.md)

## Returns

[`StationKind`](../../../types/type-aliases/StationKind.md) \| `null`
