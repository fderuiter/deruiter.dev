[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/objective](../README.md) / getExitLockState

# Function: getExitLockState()

> **getExitLockState**(`boss`, `tspNodes`): [`ExitLockState`](../interfaces/ExitLockState.md)

Works out whether the exit is locked from the room's boss and route nodes.

## Parameters

### boss

[`BossState`](../../types/interfaces/BossState.md) \| `undefined`

The room's boss, if it has one.

### tspNodes

readonly [`TSPNode`](../../types/interfaces/TSPNode.md)[] \| `undefined`

The room's airgap route nodes, if it has any.

## Returns

[`ExitLockState`](../interfaces/ExitLockState.md)

The lock state, objective line and locked-exit message.
