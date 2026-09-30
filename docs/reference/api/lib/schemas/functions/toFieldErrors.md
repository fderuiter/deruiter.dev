[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/schemas](../README.md) / toFieldErrors

# Function: toFieldErrors()

> **toFieldErrors**(`error`): `Record`\<`string`, `string`\>

Collapses a Zod validation error into one message per top-level field, the
shape client forms render inline beside each input. Nested issues (such as
`tags[2]`) are reported under their owning field, and the first issue for a
field wins so messages follow the schema's declaration order. Issues not
tied to a field are omitted; read `error.issues` for those.

## Parameters

### error

`ZodError`

The error from a failed `safeParse` of a form schema.

## Returns

`Record`\<`string`, `string`\>

A map from field name to its first validation message.
