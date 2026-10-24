[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/semantic/plan](../README.md) / SourcePlan

# Interface: SourcePlan

One source of a planned query, with its group-by and filter paths.

## Extends

- [`FormulaSource`](FormulaSource.md)

## Properties

### filters

> `readonly` **filters**: readonly [`PlannedFilter`](PlannedFilter.md)[]

Filters in force, each with its path.

***

### groupBy

> `readonly` **groupBy**: readonly [`DimensionPath`](../../dimensions/interfaces/DimensionPath.md)[]

Paths of the grouped dimensions, in query order.

***

### measure

> `readonly` **measure**: [`MetricMeasure`](../../../../types/interfaces/MetricMeasure.md) \| `null`

#### Inherited from

[`FormulaSource`](FormulaSource.md).[`measure`](FormulaSource.md#measure)

***

### role

> `readonly` **role**: [`SourceRole`](../type-aliases/SourceRole.md)

#### Inherited from

[`FormulaSource`](FormulaSource.md).[`role`](FormulaSource.md#role)

***

### table

> `readonly` **table**: `string`

#### Inherited from

[`FormulaSource`](FormulaSource.md).[`table`](FormulaSource.md#table)

***

### timeKey

> `readonly` **timeKey**: `string` \| `null`

#### Inherited from

[`FormulaSource`](FormulaSource.md).[`timeKey`](FormulaSource.md#timekey)
