[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/scenario-impact](../README.md) / ScenarioStaleReason

# Interface: ScenarioStaleReason

One reason a scenario's evidence is stale.

## Properties

### aspects

> **aspects**: `string`[]

Aspects that changed, e.g. `formula` or `codes`. Empty for added/removed.

***

### change

> **change**: [`ScenarioDependencyChange`](../type-aliases/ScenarioDependencyChange.md)

***

### dependency

> **dependency**: [`ScenarioDependencyRef`](ScenarioDependencyRef.md)

***

### message

> **message**: `string`

One sentence suitable for a stale label or an export package.

***

### navigation

> **navigation**: [`ScenarioImpactNavigationTarget`](ScenarioImpactNavigationTarget.md)

***

### objectLabel

> **objectLabel**: `string`

Display name of the object (its current label, or its id when gone).
