[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/arcade-achievements](../README.md) / ArcadeRun

# Interface: ArcadeRun

One finished run, as a game reports it to the arcade (#2371).

## Properties

### durationMs?

> `optional` **durationMs?**: `number`

How long the run took, in milliseconds.

***

### mode?

> `optional` **mode?**: `string`

The game's mode, e.g. "campaign" or "daily".

***

### score

> **score**: `number`

The run's score; the best one is kept.

***

### view

> **view**: [`FormFactor`](../../arcade/form-factor/type-aliases/FormFactor.md)

The view the run was played in (ADR 0062), for launch telemetry.
