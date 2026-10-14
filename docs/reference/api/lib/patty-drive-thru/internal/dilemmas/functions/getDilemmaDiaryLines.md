[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/dilemmas](../README.md) / getDilemmaDiaryLines

# Function: getDilemmaDiaryLines()

> **getDilemmaDiaryLines**(`choices`): `string`[]

The diary lines a shift's answers leave, one per dilemma, in the order
they were answered. An answer the clock made reads as such. Unknown ids,
as an edited save might hold, are skipped.

## Parameters

### choices

readonly `Pick`\<[`DilemmaChoice`](../../../types/interfaces/DilemmaChoice.md), `"dilemmaId"` \| `"optionId"` \| `"timedOut"`\>[]

## Returns

`string`[]
