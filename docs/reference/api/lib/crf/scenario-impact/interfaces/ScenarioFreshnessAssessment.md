[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/scenario-impact](../README.md) / ScenarioFreshnessAssessment

# Interface: ScenarioFreshnessAssessment

Freshness of one scenario, with the reasons behind it.

## Properties

### formId

> **formId**: `string`

***

### freshness

> **freshness**: [`ScenarioFreshness`](../type-aliases/ScenarioFreshness.md)

***

### label

> **label**: `string`

Short human label, e.g. "Stale: calculation formula of BMI changed".

***

### lastRanAt?

> `optional` **lastRanAt?**: `string`

When the evidence was produced, if it exists. Never implies currency.

***

### reasons

> **reasons**: [`ScenarioStaleReason`](ScenarioStaleReason.md)[]

***

### rerunnable

> **rerunnable**: `boolean`

False when the scenario's form no longer exists, so it cannot be rerun.

***

### scenarioId

> **scenarioId**: `string`

***

### scenarioName

> **scenarioName**: `string`

***

### standing

> **standing**: [`ScenarioImpactStanding`](../type-aliases/ScenarioImpactStanding.md)
