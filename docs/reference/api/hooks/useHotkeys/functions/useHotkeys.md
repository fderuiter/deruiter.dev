[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useHotkeys](../README.md) / useHotkeys

# Function: useHotkeys()

> **useHotkeys**(`hotkeys`, `handler`, `options?`): `void`

Binds one or more keyboard shortcuts to a handler for the lifetime of the component.

Shortcuts are ignored while the user is typing in form fields or
contenteditable regions, and inside `[data-keyboard-boundary]` regions,
unless the matching option opts in. `Mod` means Command on macOS and Ctrl
elsewhere. The listener is removed on unmount or when `enabled` becomes
false, and the latest handler is always called without re-binding.

## Parameters

### hotkeys

`string` \| readonly `string`[]

A hotkey string or a list of them, e.g. `"Mod+K"` or `["Escape", "q"]`.

### handler

[`HotkeyHandler`](../type-aliases/HotkeyHandler.md)

Called with the event and the hotkey string that matched.

### options?

[`UseHotkeysOptions`](../interfaces/UseHotkeysOptions.md) = `{}`

Behavior options; see [UseHotkeysOptions](../interfaces/UseHotkeysOptions.md).

## Returns

`void`

## Example

```tsx
useHotkeys("Mod+K", () => setOpen(true), { preventDefault: true });
useHotkeys(["?", "h"], toggleHelp);
```
