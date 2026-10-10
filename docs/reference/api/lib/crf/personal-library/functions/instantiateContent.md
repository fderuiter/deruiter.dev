[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/personal-library](../README.md) / instantiateContent

# Function: instantiateContent()

> **instantiateContent**(`sourceSections`, `sourceRules`, `sourceCodelists`, `options?`): [`InstantiatedContent`](../interfaces/InstantiatedContent.md)

Deep-copies sections, rules and codelists for insertion into a study.

Every identity is freshly allocated and every internal reference remapped -
rule targets, trigger lists, condition operands including grouped and
field-to-field comparisons, calculation formulas and codelist references -
so the copy shares nothing with its source or with any previous copy.
Variable names that collide with `options.existingVariableNames`, or with
an earlier section of the same copy, get a fresh CDASH name.

## Parameters

### sourceSections

readonly [`CRFSection`](../../types/interfaces/CRFSection.md)[]

### sourceRules

readonly [`EditCheckRule`](../../types/interfaces/EditCheckRule.md)[]

### sourceCodelists

readonly [`CodelistDefinition`](../../types/interfaces/CodelistDefinition.md)[]

### options?

[`InstantiateLibraryEntryOptions`](../interfaces/InstantiateLibraryEntryOptions.md)

## Returns

[`InstantiatedContent`](../interfaces/InstantiatedContent.md)
