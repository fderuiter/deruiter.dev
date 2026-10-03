[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/scenario-impact](../README.md) / collectScenarioDependencies

# Function: collectScenarioDependencies()

> **collectScenarioDependencies**(`scenario`, `study`): [`ScenarioDependencyRef`](../interfaces/ScenarioDependencyRef.md)[]

Lists the study objects a scenario's outcome depends on, derived from its
expectations: the fields it reads, the formulas and rule conditions behind
them, their codelists, the visit its record sits at and any cross-visit
comparison visits. Pure; the study is not modified.

## Parameters

### scenario

[`TestScenario`](../../types/interfaces/TestScenario.md)

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

## Returns

[`ScenarioDependencyRef`](../interfaces/ScenarioDependencyRef.md)[]
