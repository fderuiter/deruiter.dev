[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useSafeTimeout](../README.md) / useSafeTimeout

# Function: useSafeTimeout()

> **useSafeTimeout**(): [`SafeTimeoutControls`](../interfaces/SafeTimeoutControls.md)

Returns lifecycle-safe replacements for `setTimeout` and `clearTimeout`.

Use it for one-shot delays started from event handlers or callbacks, such
as dismissing a toast bubble or pausing between scripted steps. Every
timeout scheduled through the returned `setSafeTimeout` is tracked and
cleared when the component unmounts, so a delayed callback can never update
state or play audio for a component that is gone.

For repeating work driven by a delay, use `useInterval`. For collapsing
bursts of calls, use `useDebouncedCallback` or `useThrottledCallback`.

## Returns

[`SafeTimeoutControls`](../interfaces/SafeTimeoutControls.md)
