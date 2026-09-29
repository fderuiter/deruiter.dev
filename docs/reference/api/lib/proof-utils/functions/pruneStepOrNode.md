[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/proof-utils](../README.md) / pruneStepOrNode

# Function: pruneStepOrNode()

> **pruneStepOrNode**(`stepOrNode`, `edges`, `theoremId?`): [`PruneResult`](../interfaces/PruneResult.md)

Prunes an intermediate lemma or conclusion deduction step and recursively removes dependent edges in the DAG.
Foundational premises are immutable axioms and cannot be deleted.

## Parameters

### stepOrNode

`string` \| `number`

### edges

[`Edge`](../interfaces/Edge.md)[]

### theoremId?

[`TheoremDefinition`](../interfaces/TheoremDefinition.md) \| [`TheoremId`](../type-aliases/TheoremId.md)

## Returns

[`PruneResult`](../interfaces/PruneResult.md)
