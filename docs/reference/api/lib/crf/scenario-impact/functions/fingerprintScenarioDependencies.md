[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/scenario-impact](../README.md) / fingerprintScenarioDependencies

# Function: fingerprintScenarioDependencies()

> **fingerprintScenarioDependencies**(`scenario`, `study`): [`ScenarioDependencySnapshot`](../../types/interfaces/ScenarioDependencySnapshot.md)

Fingerprints every dependency aspect of a scenario against a study,
keyed `kind:id/aspect`. Only semantic material participates, so label-only
edits leave every fingerprint unchanged.

## Parameters

### scenario

[`TestScenario`](../../types/interfaces/TestScenario.md)

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

## Returns

[`ScenarioDependencySnapshot`](../../types/interfaces/ScenarioDependencySnapshot.md)
