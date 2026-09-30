[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useInterval](../README.md) / useInterval

# Function: useInterval()

> **useInterval**(`callback`, `delayMs`): `void`

Runs `callback` every `delayMs` milliseconds while the component is mounted.

Pass `null` as the delay to pause; passing a number again starts a fresh
interval. Changing the delay restarts the interval with the new period. The
interval is cleared on unmount.

Each tick invokes the latest `callback`, so it reads current props and
state without restarting the interval when the callback's identity changes.

## Parameters

### callback

() => `void`

### delayMs

`number` \| `null`

## Returns

`void`
