[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/coordinator](../README.md) / fieldCost

# Function: fieldCost()

> **fieldCost**(`spec`): `number`

c_f = base(type) + floor(max(0, options - 1) / 8) + nesting, plus 6 when
the field throws a hard-stop error during entry.

## Parameters

### spec

[`EntryFieldSpec`](../../../types/interfaces/EntryFieldSpec.md)

## Returns

`number`
