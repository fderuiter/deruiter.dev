[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useSafeTimeout](../README.md) / SafeTimeoutControls

# Interface: SafeTimeoutControls

Scheduling controls returned by `useSafeTimeout`. Every function has a
stable identity for the lifetime of the component, so they are safe to use
in dependency arrays.

## Properties

### clearAll

> **clearAll**: () => `void`

Cancels every timeout this component still has pending.

#### Returns

`void`

***

### clearSafeTimeout

> **clearSafeTimeout**: (`id`) => `void`

Cancels a pending timeout. Handles that already fired, were already
cleared, or are null or undefined are ignored.

#### Parameters

##### id

`number` \| `null` \| `undefined`

#### Returns

`void`

***

### pendingCount

> **pendingCount**: () => `number`

Number of timeouts still pending.

#### Returns

`number`

***

### setSafeTimeout

> **setSafeTimeout**: (`fn`, `delayMs`) => `number`

Schedules `fn` to run once after `delayMs` milliseconds. The timeout is
tracked and cleared automatically when the component unmounts. Calls made
after unmount schedule nothing.

#### Parameters

##### fn

() => `void`

##### delayMs

`number`

#### Returns

`number`
