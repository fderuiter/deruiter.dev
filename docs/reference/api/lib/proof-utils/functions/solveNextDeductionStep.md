[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/proof-utils](../README.md) / solveNextDeductionStep

# Function: solveNextDeductionStep()

> **solveNextDeductionStep**(`nodes`, `edges`, `targetNodeId`): [`AutoStepResult`](../interfaces/AutoStepResult.md)

Finds the next valid deduction step via forward-chaining deduction engine
without referencing hardcoded theorem graph edges.

## Parameters

### nodes

[`ProofNode`](../interfaces/ProofNode.md)[]

### edges

[`Edge`](../interfaces/Edge.md)[]

### targetNodeId

`string`

## Returns

[`AutoStepResult`](../interfaces/AutoStepResult.md)
