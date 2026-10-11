[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/receipt](../README.md) / categoryProgress

# Function: categoryProgress()

> **categoryProgress**(`state`, `category`): [`CategoryProgress`](../../../types/interfaces/CategoryProgress.md) \| `null`

How far a category is, counted in items. A target takes as many items as its
capacity, so the basket is two items rather than one target, and a half-filled
target shows its items placed. Simplified targets leave the plan. Null when
the cart plans nothing in the category.

## Parameters

### state

[`GameState`](../../../types/interfaces/GameState.md)

### category

[`Category`](../../../types/type-aliases/Category.md)

## Returns

[`CategoryProgress`](../../../types/interfaces/CategoryProgress.md) \| `null`
