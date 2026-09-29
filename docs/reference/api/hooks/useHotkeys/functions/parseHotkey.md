[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useHotkeys](../README.md) / parseHotkey

# Function: parseHotkey()

> **parseHotkey**(`hotkey`): [`ParsedHotkey`](../interfaces/ParsedHotkey.md)

Parses a hotkey string such as `Mod+K`, `Shift+?` or `Escape`.

Modifier names are case-insensitive: `Mod`, `Ctrl`/`Control`, `Meta`/`Cmd`/`Command`,
`Alt`/`Option` and `Shift`. The final segment is the key; use `Plus` for a literal plus sign.

## Parameters

### hotkey

`string`

The hotkey description.

## Returns

[`ParsedHotkey`](../interfaces/ParsedHotkey.md)

The parsed modifiers and key.
