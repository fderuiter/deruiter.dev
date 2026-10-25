[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/rbqm](../README.md) / RiskSignalLogEntry

# Interface: RiskSignalLogEntry

One entry of a study's append-only risk signal log.

## Properties

### action

> `readonly` **action**: [`RiskSignalAction`](../type-aliases/RiskSignalAction.md) \| `null`

The action taken; on `actioned` entries only, otherwise `null`.

***

### by

> `readonly` **by**: `string`

Who recorded it: a role, or the automated central monitoring.

***

### event

> `readonly` **event**: [`RiskSignalEvent`](../type-aliases/RiskSignalEvent.md)

***

### note

> `readonly` **note**: `string`

What was found, decided or done.

***

### on

> `readonly` **on**: `string`

ISO 8601 date of the event.

***

### sequence

> `readonly` **sequence**: `number`

Position in the log, from 1, with no gaps.

***

### signalId

> `readonly` **signalId**: `string`

Signal id, for example `DEMO-302-SIG-001`.

***

### source

> `readonly` **source**: [`RiskSignalSource`](../type-aliases/RiskSignalSource.md) \| `null`

Where the signal came from; on `raised` entries only, otherwise `null`.
