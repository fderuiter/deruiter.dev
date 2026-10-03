[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/persona](../README.md) / normalizePersona

# Function: normalizePersona()

> **normalizePersona**(`value`): [`PersonaType`](../type-aliases/PersonaType.md)

Narrows any stored or URL-supplied value to a reading mode.

Current values pass through unchanged. The two legacy values map to their
renamed equivalents, so a visitor who chose the deep-dive layer before the
rename still lands in Behind the Scenes. Anything else resolves to the
Professional default.

## Parameters

### value

`unknown`

A raw value from storage, a URL parameter or a caller.

## Returns

[`PersonaType`](../type-aliases/PersonaType.md)

The matching reading mode.
