[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/engine](../README.md) / ProtocolDriftEngine

# Interface: ProtocolDriftEngine

A running Protocol Drift simulation.

## Methods

### commandLog()

> **commandLog**(): [`PDCommand`](../../../types/type-aliases/PDCommand.md)[]

The accepted command log, as a save file would store it.

#### Returns

[`PDCommand`](../../../types/type-aliases/PDCommand.md)[]

***

### dispatch()

> **dispatch**(`command`): [`PDWorkerEvent`](../../../types/type-aliases/PDWorkerEvent.md)[]

Applies one command and returns the events it produced.

#### Parameters

##### command

[`PDCommand`](../../../types/type-aliases/PDCommand.md)

#### Returns

[`PDWorkerEvent`](../../../types/type-aliases/PDWorkerEvent.md)[]

***

### stateHash()

> **stateHash**(): `string`

A stable hash of the ledgers, queries, issues and audit trail.

#### Returns

`string`

***

### view()

> **view**(): [`ProtocolDriftView`](../../../types/interfaces/ProtocolDriftView.md)

A deep copy of the current state.

#### Returns

[`ProtocolDriftView`](../../../types/interfaces/ProtocolDriftView.md)
