[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useDebounce](../README.md) / useDebouncedCallback

# Function: useDebouncedCallback()

> **useDebouncedCallback**\<`Args`\>(`fn`, `delayMs`, `options?`): [`TimedCallback`](../interfaces/TimedCallback.md)\<`Args`\>

Returns a stable debounced wrapper around `fn`. The wrapper always invokes
the latest `fn`, so it never captures stale props or state.

Defaults to trailing-edge only. With `leading: true` the first call of a
burst runs immediately; the trailing call then runs only if further calls
arrived during the burst. The pending timer is cancelled on unmount.

## Type Parameters

### Args

`Args` *extends* `unknown`[]

## Parameters

### fn

(...`args`) => `unknown`

### delayMs

`number`

### options?

[`TimingEdgeOptions`](../interfaces/TimingEdgeOptions.md) = `{}`

## Returns

[`TimedCallback`](../interfaces/TimedCallback.md)\<`Args`\>
