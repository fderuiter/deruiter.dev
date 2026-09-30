[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useAnimationFrame](../README.md) / useAnimationFrame

# Function: useAnimationFrame()

> **useAnimationFrame**(`callback`, `options?`): `void`

Runs a callback on every animation frame while active, with delta-time
clamping and cancellation handled in one place.

The loop is keyed only on `isActive` and `restartKey`. The callback and the
other options are read through refs, so passing a new closure on every
render never tears the loop down or resets its clock. The pending frame is cancelled synchronously
when the component unmounts or `isActive` becomes false, so a callback never
runs against an unmounted tree. On the server, and anywhere
`requestAnimationFrame` is unavailable, the hook does nothing.

## Parameters

### callback

[`AnimationFrameCallback`](../type-aliases/AnimationFrameCallback.md)

Invoked once per delivered frame with the clamped delta
  and the accumulated simulation time, both in milliseconds.

### options?

[`UseAnimationFrameOptions`](../interfaces/UseAnimationFrameOptions.md) = `{}`

Activity flag, delta ceiling, optional frame-rate cap and
  restart key.

## Returns

`void`

## Example

```ts
useAnimationFrame((deltaMs) => {
  engine.step(deltaMs / 1000);
  engine.render(ctx);
}, { isActive: !isPaused });
```
