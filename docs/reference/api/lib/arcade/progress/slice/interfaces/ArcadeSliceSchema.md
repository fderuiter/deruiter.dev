[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/slice](../README.md) / ArcadeSliceSchema

# Interface: ArcadeSliceSchema\<T\>

The schema a slice validates with. A Zod schema fits; so does anything
with the same `safeParse`.

## Type Parameters

### T

`T`

## Methods

### safeParse()

> **safeParse**(`value`): \{ `data`: `T`; `success`: `true`; \} \| \{ `error?`: `unknown`; `success`: `false`; \}

#### Parameters

##### value

`unknown`

#### Returns

\{ `data`: `T`; `success`: `true`; \} \| \{ `error?`: `unknown`; `success`: `false`; \}
