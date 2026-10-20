[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/step-clock](../README.md) / StepClock

# Interface: StepClock

A fixed-step clock. A loop passes each frame's elapsed time to `advance`
and runs the game that many steps, each with the constant `dt`.

Methods do not rely on `this`.

## Properties

### advance

> `readonly` **advance**: (`elapsedSeconds`) => `number`

Adds a frame's elapsed time and returns how many whole steps to run now.
A negative or non-finite elapsed time counts as 0.

#### Parameters

##### elapsedSeconds

`number`

#### Returns

`number`

***

### alpha

> `readonly` **alpha**: () => `number`

How far the clock is into the next step, in [0, 1), for interpolation.

#### Returns

`number`

***

### dt

> `readonly` **dt**: `number`

The constant step, in seconds.

***

### elapsedSeconds

> `readonly` **elapsedSeconds**: () => `number`

The run's simulated time in seconds: `getStep() * dt`.

#### Returns

`number`

***

### getStep

> `readonly` **getStep**: () => `number`

Steps run so far in this run. A run snapshot carries it as `step`.

#### Returns

`number`

***

### setStep

> `readonly` **setStep**: (`step`) => `void`

Moves the count to a restored run's `step`. Throws RangeError unless
`step` is a non-negative integer. Clears any carried partial step.

#### Parameters

##### step

`number`

#### Returns

`void`

***

### tick

> `readonly` **tick**: () => `void`

Runs exactly one step, for tests, replays and a single-step debugger.

#### Returns

`void`
