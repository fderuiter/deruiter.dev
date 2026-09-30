[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useAnimationFrame](../README.md) / UseAnimationFrameOptions

# Interface: UseAnimationFrameOptions

Options for [useAnimationFrame](../functions/useAnimationFrame.md).

## Properties

### fpsLimit?

> `optional` **fpsLimit?**: `number`

Optional upper bound on invocations per second. Frames that arrive sooner
than the interval are skipped, and their time is carried into the next
delivered delta, so a limited loop still sees the full elapsed time.
Omit, or pass zero, a negative number or NaN, to run on every frame.

***

### isActive?

> `optional` **isActive?**: `boolean`

Whether the loop runs. Defaults to true. Setting it to false cancels the
pending frame immediately; setting it back to true starts a fresh loop,
so the first frame again receives a delta of 0 and `elapsedMs` restarts.

***

### maxDeltaMs?

> `optional` **maxDeltaMs?**: `number`

Ceiling on a single frame's delta, in milliseconds. Defaults to 100.
Browsers pause or throttle animation frames in hidden tabs, so the first
frame after the tab returns would otherwise report the whole time away.
Pass `Infinity` to disable clamping. Zero, negative and NaN values fall
back to the default.

***

### restartKey?

> `optional` **restartKey?**: `unknown`

Any value whose change restarts the loop. When it differs from the
previous render's value (compared with `Object.is`), the pending frame is
cancelled and a fresh loop starts, exactly as if `isActive` had toggled:
the first frame receives a delta of 0 and `elapsedMs` restarts. Use it
for inputs that should begin a new clock, such as a swapped simulation
engine. Callback closures do not need it; they are always read fresh.
