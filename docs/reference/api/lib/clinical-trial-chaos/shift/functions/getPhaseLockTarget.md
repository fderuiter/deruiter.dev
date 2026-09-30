[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / getPhaseLockTarget

# Function: getPhaseLockTarget()

> **getPhaseLockTarget**(`phase`): `number`

New CRF locks a campaign phase asks for: its clearing total less the
previous phase's (5, 3 and 4).

## Parameters

### phase

[`GamePhase`](../../types/type-aliases/GamePhase.md)

The campaign phase.

## Returns

`number`

The phase's own lock target.
