[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useThrottle](../README.md) / useThrottledCallback

# Function: useThrottledCallback()

> **useThrottledCallback**\<`Args`\>(`fn`, `intervalMs`, `options?`): [`TimedCallback`](../../useDebounce/interfaces/TimedCallback.md)\<`Args`\>

Returns a stable throttled wrapper around `fn` that invokes it at most once
per `intervalMs`. The wrapper always invokes the latest `fn`, so it never
captures stale props or state.

Defaults to both edges: the first call of a window runs immediately and the
last call made during the window runs when it closes. Pass
`trailing: false` to drop calls inside the window instead. An interval of
zero or less invokes on every call. The pending timer is cancelled on
unmount.

This is a wall-clock throttle. Work that should coalesce to the display
refresh, such as pointer raycasting, belongs in requestAnimationFrame.

## Type Parameters

### Args

`Args` *extends* `unknown`[]

## Parameters

### fn

(...`args`) => `unknown`

### intervalMs

`number`

### options?

[`TimingEdgeOptions`](../../useDebounce/interfaces/TimingEdgeOptions.md) = `{}`

## Returns

[`TimedCallback`](../../useDebounce/interfaces/TimedCallback.md)\<`Args`\>
