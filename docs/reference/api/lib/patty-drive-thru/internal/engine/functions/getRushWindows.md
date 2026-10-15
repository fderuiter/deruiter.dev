[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/engine](../README.md) / getRushWindows

# Function: getRushWindows()

> **getRushWindows**(`config`): readonly [`RushWindow`](../../../types/type-aliases/RushWindow.md)[]

The rushes a shift has (#2086): the ones its config names, or else the
standard lunch and dinner rushes (#2138), unless a scenario set its own
arrival gaps, which it then keeps exactly (#1938).

## Parameters

### config

[`ShiftConfig`](../../../types/interfaces/ShiftConfig.md)

## Returns

readonly [`RushWindow`](../../../types/type-aliases/RushWindow.md)[]
