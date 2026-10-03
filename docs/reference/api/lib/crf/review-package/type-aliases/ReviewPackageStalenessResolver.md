[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/review-package](../README.md) / ReviewPackageStalenessResolver

# Type Alias: ReviewPackageStalenessResolver

> **ReviewPackageStalenessResolver** = (`scenario`, `form`) => [`ReviewPackageStaleness`](ReviewPackageStaleness.md) \| `undefined`

Decides whether a scenario's saved evidence is stale. Return `undefined` to
fall back to the built-in form-fingerprint check. `form` is undefined when
the scenario's target form is no longer part of the study.

## Parameters

### scenario

[`TestScenario`](../../types/interfaces/TestScenario.md)

### form

[`CRFForm`](../../types/interfaces/CRFForm.md) \| `undefined`

## Returns

[`ReviewPackageStaleness`](ReviewPackageStaleness.md) \| `undefined`
