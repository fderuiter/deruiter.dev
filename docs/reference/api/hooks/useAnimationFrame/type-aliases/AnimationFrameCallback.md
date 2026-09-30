[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useAnimationFrame](../README.md) / AnimationFrameCallback

# Type Alias: AnimationFrameCallback

> **AnimationFrameCallback** = (`deltaMs`, `elapsedMs`) => `void`

Per-frame callback for [useAnimationFrame](../functions/useAnimationFrame.md).

## Parameters

### deltaMs

`number`

Milliseconds since the previous invocation, clamped to
  `maxDeltaMs`. The first invocation after the loop starts receives 0.

### elapsedMs

`number`

Sum of every clamped `deltaMs` since the loop last
  started. It is a simulation clock: a hidden tab adds at most `maxDeltaMs`
  to it, never the wall-clock gap.

## Returns

`void`
