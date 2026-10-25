[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/explore](../README.md) / ExplorationChoices

# Interface: ExplorationChoices

What can change in an exploration next without breaking it.

## Properties

### addDimensions

> `readonly` **addDimensions**: readonly [`MetricDimensionId`](../../platform/type-aliases/MetricDimensionId.md)[]

Dimensions that can be added to the grouping, in dimension order.

***

### filterDimensions

> `readonly` **filterDimensions**: readonly [`MetricDimensionId`](../../platform/type-aliases/MetricDimensionId.md)[]

Dimensions the metric may be filtered by, in dimension order.

***

### removeDimensions

> `readonly` **removeDimensions**: readonly [`MetricDimensionId`](../../platform/type-aliases/MetricDimensionId.md)[]

Grouped dimensions that can be removed; a study grain metric keeps `study`.

***

### visuals

> `readonly` **visuals**: readonly [`ReportVisual`](../../platform/type-aliases/ReportVisual.md)[]

Visuals that fit the grouping, in `EXPLORER_VISUALS` order.
