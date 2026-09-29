[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useHotkeys](../README.md) / matchesHotkey

# Function: matchesHotkey()

> **matchesHotkey**(`event`, `hotkey`, `isApple?`): `boolean`

Checks whether a keydown event matches a hotkey.

Ctrl, Meta and Alt must match exactly, so `K` does not fire on `Ctrl+K`.
Shift is only required when the hotkey names it, because Shift is already
reflected in `event.key` for printable characters such as `?`.

## Parameters

### event

`Pick`\<`KeyboardEvent`, `"key"` \| `"ctrlKey"` \| `"metaKey"` \| `"altKey"` \| `"shiftKey"`\>

The keydown event.

### hotkey

`string` \| [`ParsedHotkey`](../interfaces/ParsedHotkey.md)

A hotkey string or a parsed hotkey.

### isApple?

`boolean` = `...`

Whether `Mod` means Command. Defaults to the detected platform.

## Returns

`boolean`

True when the event matches.
