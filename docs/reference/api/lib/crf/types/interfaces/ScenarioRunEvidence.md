[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/types](../README.md) / ScenarioRunEvidence

# Interface: ScenarioRunEvidence

## Properties

### dependencies?

> `optional` **dependencies?**: [`ScenarioDependencySnapshot`](ScenarioDependencySnapshot.md)

Per-dependency fingerprints recorded at run time (#679), so an amendment
can be attributed to the specific field, rule, codelist or visit it
touched. Absent on evidence recorded before dependency tracking existed.

***

### failed

> **failed**: `number`

***

### formFingerprint

> **formFingerprint**: `string`

***

### passed

> **passed**: `number`

***

### ranAt

> **ranAt**: `string`

***

### results

> **results**: [`ScenarioExpectationResult`](ScenarioExpectationResult.md)[]
