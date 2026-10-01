[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/ast-debugger](../README.md) / AstDebugStep

# Interface: AstDebugStep

## Properties

### actualValue

> **actualValue**: `string` \| `number` \| `boolean` \| `null` \| `undefined`

***

### comparedValue?

> `optional` **comparedValue?**: `string` \| `number` \| `boolean` \| `string`[] \| `null`

***

### comparedVariableName?

> `optional` **comparedVariableName?**: `string`

***

### condition?

> `optional` **condition?**: [`AstCondition`](../../types/interfaces/AstCondition.md)

***

### diagnostics

> **diagnostics**: `string`[]

***

### fieldId?

> `optional` **fieldId?**: `string`

***

### group?

> `optional` **group?**: [`ConditionGroup`](../../types/interfaces/ConditionGroup.md)

***

### nodeId

> **nodeId**: `string`

***

### nodeType

> **nodeType**: `"condition"` \| `"group"` \| `"rule_summary"`

***

### operator?

> `optional` **operator?**: `string`

***

### operatorLabel?

> `optional` **operatorLabel?**: `string`

***

### result

> **result**: [`ConditionResult`](../../types/type-aliases/ConditionResult.md)

***

### sentence

> **sentence**: `string`

***

### shortCircuited

> **shortCircuited**: `boolean`

***

### shortCircuitReason?

> `optional` **shortCircuitReason?**: `string`

***

### stepIndex

> **stepIndex**: `number`

***

### variableName

> **variableName**: `string`
