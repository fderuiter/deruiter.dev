[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / lib/arcade/step-clock

# lib/arcade/step-clock

The session's fixed-step clock (#2544, ADR 0062).

A session advances its game in whole steps of a constant `dt`, never by the
frame's variable time, so outcomes do not depend on frame rate. A phone on
a throttled frame budget runs more steps per frame, not longer ones, and a
replay at a fixed step matches the recording.

Spawn and drop chances are per step: roll [stepChance](functions/stepChance.md) once per
step with the session's `rng`, never `Math.random() < rate * frameDt`.

## Interfaces

- [StepClock](interfaces/StepClock.md)
- [StepClockOptions](interfaces/StepClockOptions.md)

## Variables

- [SESSION\_STEP\_MS](variables/SESSION_STEP_MS.md)
- [SESSION\_STEP\_SECONDS](variables/SESSION_STEP_SECONDS.md)

## Functions

- [createStepClock](functions/createStepClock.md)
- [isStepCount](functions/isStepCount.md)
- [stepChance](functions/stepChance.md)
