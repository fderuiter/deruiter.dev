[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/scenario-impact](../README.md) / ScenarioImpactReport

# Interface: ScenarioImpactReport

Study-wide answer to "which saved tests does this amendment affect?".

## Properties

### affected

> **affected**: [`ScenarioFreshnessAssessment`](ScenarioFreshnessAssessment.md)[]

Scenarios whose evidence is stale or unverifiable: candidates to rerun.

***

### assessments

> **assessments**: [`ScenarioFreshnessAssessment`](ScenarioFreshnessAssessment.md)[]

***

### changedObjects

> **changedObjects**: [`AmendedObjectImpact`](AmendedObjectImpact.md)[]

***

### counts

> **counts**: `Record`\<[`ScenarioFreshness`](../type-aliases/ScenarioFreshness.md), `number`\>
