[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/explore](../README.md) / ExplorationResult

# Interface: ExplorationResult

An exploration run over one warehouse, ready to render.

## Properties

### choices

> `readonly` **choices**: [`ExplorationChoices`](ExplorationChoices.md)

What can change next.

***

### defaultFilters

> `readonly` **defaultFilters**: readonly [`MetricFilter`](../../platform/interfaces/MetricFilter.md)[]

The metric's default filters in force: those the exploration does not replace.

***

### exploration

> `readonly` **exploration**: [`Exploration`](Exploration.md)

The exploration, normalized: filters in dimension order, values sorted.

***

### filterValues

> `readonly` **filterValues**: `Readonly`\<`Partial`\<`Record`\<[`MetricDimensionId`](../../platform/type-aliases/MetricDimensionId.md), readonly `string`[]\>\>\>

Values each filterable dimension takes in the warehouse, sorted.

***

### replacedDefaults

> `readonly` **replacedDefaults**: readonly [`MetricFilter`](../../platform/interfaces/MetricFilter.md)[]

The metric's default filters the exploration's own filters replace.

***

### report

> `readonly` **report**: [`ReportData`](../../platform/interfaces/ReportData.md)

The report, drawn with the chosen visual or else the suggested one.

***

### spec

> `readonly` **spec**: [`ReportSpec`](../../platform/interfaces/ReportSpec.md)

The exploratory report spec the exploration builds.

***

### suggestedVisual

> `readonly` **suggestedVisual**: [`ReportVisual`](../../platform/type-aliases/ReportVisual.md)

The visual the explorer suggests for the data's shape.
