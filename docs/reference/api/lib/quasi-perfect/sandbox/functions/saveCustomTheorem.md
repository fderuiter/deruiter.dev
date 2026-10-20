[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/sandbox](../README.md) / saveCustomTheorem

# Function: saveCustomTheorem()

> **saveCustomTheorem**(`theorems`, `draft`): [`CustomTheoremSaveResult`](../interfaces/CustomTheoremSaveResult.md)

Add a theorem to the collection. A formula or hypotheses that do not
parse, a full collection, and a theorem whose trimmed formula and
hypotheses are already saved all leave the collection unchanged.

## Parameters

### theorems

readonly [`CustomTheorem`](../interfaces/CustomTheorem.md)[]

The saved collection.

### draft

[`CustomTheoremDraft`](../type-aliases/CustomTheoremDraft.md)

The theorem to add; an empty title falls back to the formula.

## Returns

[`CustomTheoremSaveResult`](../interfaces/CustomTheoremSaveResult.md)

Whether it was saved, a message for the player, and the collection.
