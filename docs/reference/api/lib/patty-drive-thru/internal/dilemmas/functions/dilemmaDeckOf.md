[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/dilemmas](../README.md) / dilemmaDeckOf

# Function: dilemmaDeckOf()

> **dilemmaDeckOf**(`value`): readonly [`DilemmaId`](../../../types/type-aliases/DilemmaId.md)[] \| `undefined`

A configured dilemma deck (#2139): the known ids in the list, each once,
in order. Anything that is not a list is left out, so the shift draws its
own; a list with no known ids is an empty deck, and the shift asks nothing.

## Parameters

### value

`unknown`

## Returns

readonly [`DilemmaId`](../../../types/type-aliases/DilemmaId.md)[] \| `undefined`
