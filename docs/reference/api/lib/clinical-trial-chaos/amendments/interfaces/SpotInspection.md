[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/amendments](../README.md) / SpotInspection

# Interface: SpotInspection

A GCP spot inspection in progress.

## Properties

### durationSeconds

> **durationSeconds**: `number`

The window's full length.

***

### misroutes

> **misroutes**: `number`

Misroutes to the watched station during the window.

***

### stationId

> **stationId**: [`CDISCDomain`](../../types/type-aliases/CDISCDomain.md)

The station the auditor watches.

***

### timeRemaining

> **timeRemaining**: `number`

Seconds left in the inspection window.
