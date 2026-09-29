[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/neuro/hotkeys](../README.md) / resolveNeuroHotkey

# Function: resolveNeuroHotkey()

> **resolveNeuroHotkey**(`e`): [`NeuroHotkeyAction`](../type-aliases/NeuroHotkeyAction.md) \| `null`

Resolve a keydown event to a studio action, or null when it must be ignored:
modifier chords, text entry, and (for Space only) natively activating
controls, which would otherwise fire twice.

## Parameters

### e

[`NeuroHotkeyEventLike`](../interfaces/NeuroHotkeyEventLike.md)

## Returns

[`NeuroHotkeyAction`](../type-aliases/NeuroHotkeyAction.md) \| `null`
