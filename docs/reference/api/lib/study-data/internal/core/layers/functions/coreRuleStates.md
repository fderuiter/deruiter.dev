[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/core/layers](../README.md) / coreRuleStates

# Function: coreRuleStates()

> **coreRuleStates**(`rules`, `counts`, `explained`): `object`

CORE's rule outcomes as matrix states, and how many failing rules have
every finding in the view explained.

## Parameters

### rules

`Readonly`\<`Record`\<`string`, [`RecordedRule`](../../recorded/interfaces/RecordedRule.md)\>\>

CORE's rules for one target, by CORE id.

### counts

`Readonly`\<`Record`\<`string`, `number`\>\>

Findings per "CORE-id dataset" in the view.

### explained

`Readonly`\<`Record`\<`string`, [`RecordedExplanation`](../../recorded/interfaces/RecordedExplanation.md)\>\>

Recorded explanations per "CORE-id dataset".

## Returns

`object`

Rules by state and the explained failure count.

### explainedFailures

> **explainedFailures**: `number`

### outcomes

> **outcomes**: `Partial`\<`Record`\<[`RuleState`](../type-aliases/RuleState.md), `number`\>\>
