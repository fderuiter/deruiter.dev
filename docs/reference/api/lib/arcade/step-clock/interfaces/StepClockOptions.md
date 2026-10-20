[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/step-clock](../README.md) / StepClockOptions

# Interface: StepClockOptions

Options for [createStepClock](../functions/createStepClock.md).

## Properties

### dt?

> `readonly` `optional` **dt?**: `number`

The constant step in seconds. Defaults to [SESSION\_STEP\_SECONDS](../variables/SESSION_STEP_SECONDS.md).

***

### maxFrameSeconds?

> `readonly` `optional` **maxFrameSeconds?**: `number`

The most frame time one `advance` carries, in seconds, so a long stall
does not run hundreds of steps at once. Defaults to 0.25.

***

### step?

> `readonly` `optional` **step?**: `number`

The step count to start from, such as a restored run's `step`.
