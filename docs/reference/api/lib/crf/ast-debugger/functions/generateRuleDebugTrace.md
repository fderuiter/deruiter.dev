[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/ast-debugger](../README.md) / generateRuleDebugTrace

# Function: generateRuleDebugTrace()

> **generateRuleDebugTrace**(`rule`, `fieldValues`, `fieldsList`, `visitContext?`): [`AstRuleDebugTrace`](../interfaces/AstRuleDebugTrace.md)

Generates a step-by-step AST execution trace for an edit check rule.

## Parameters

### rule

[`EditCheckRule`](../../types/interfaces/EditCheckRule.md)

### fieldValues

`Record`\<`string`, `string` \| `number` \| `boolean` \| `null` \| `undefined`\>

### fieldsList

[`CRFField`](../../types/interfaces/CRFField.md)[]

### visitContext?

`string`

## Returns

[`AstRuleDebugTrace`](../interfaces/AstRuleDebugTrace.md)
