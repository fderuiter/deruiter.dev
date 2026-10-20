[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/form-factor](../README.md) / parseViewOverride

# Function: parseViewOverride()

> **parseViewOverride**(`search`): [`FormFactor`](../type-aliases/FormFactor.md) \| `null`

Read a `?view=` override from a URL search string. Anything other than a
form factor name is ignored.

## Parameters

### search

`string`

A `location.search` string, with or without the `?`.

## Returns

[`FormFactor`](../type-aliases/FormFactor.md) \| `null`

The forced view, or null.
