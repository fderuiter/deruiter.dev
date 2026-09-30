[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/clock](../README.md) / ACTION\_COSTS

# Variable: ACTION\_COSTS

> `const` **ACTION\_COSTS**: `Record`\<[`WorldActionKind`](../../../types/type-aliases/WorldActionKind.md), [`ActionCost`](../../../types/interfaces/ActionCost.md)\>

What each kind of action costs. Walking is priced per tile and computed by
`actionCost`; the entry here is the cost of one tile's worth of walking at
a steady pace (four tiles a minute).
