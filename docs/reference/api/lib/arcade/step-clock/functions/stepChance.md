[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/step-clock](../README.md) / stepChance

# Function: stepChance()

> **stepChance**(`ratePerSecond`, `dt?`): `number`

The chance of an event in one step, for an event that happens `ratePerSecond`
times a second on average: `ratePerSecond * dt`, clamped to [0, 1]. At the
default 1/60 s step this matches a `rate * dt` roll at 60 frames a second,
so moving a game to per-step rolls keeps its difficulty on a 60 Hz display.

## Parameters

### ratePerSecond

`number`

The average events per second.

### dt?

`number` = `SESSION_STEP_SECONDS`

The step in seconds. Defaults to [SESSION\_STEP\_SECONDS](../variables/SESSION_STEP_SECONDS.md).

## Returns

`number`

The probability to pass to `rng.chance` once per step.
