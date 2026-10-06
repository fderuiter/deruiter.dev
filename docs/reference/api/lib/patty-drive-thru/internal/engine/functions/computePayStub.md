[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/engine](../README.md) / computePayStub

# Function: computePayStub()

> **computePayStub**(`state`): [`PayStub`](../../../types/interfaces/PayStub.md)

The pay stub for the time worked so far. Pay is prorated from a four-hour
shift; the uniform and the untaken break come out regardless, and every
expired order is a till shortage.

## Parameters

### state

[`ShiftState`](../../../types/interfaces/ShiftState.md)

## Returns

[`PayStub`](../../../types/interfaces/PayStub.md)
