[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / MetricFormula

# Type Alias: MetricFormula

> **MetricFormula** = \{ `kind`: `"simple"`; `measure`: [`MetricMeasure`](../interfaces/MetricMeasure.md); \} \| \{ `denominator`: [`MetricMeasure`](../interfaces/MetricMeasure.md); `kind`: `"ratio"`; `numerator`: [`MetricMeasure`](../interfaces/MetricMeasure.md); `scale`: `number`; \} \| \{ `from`: [`MilestoneKind`](MilestoneKind.md); `kind`: `"milestone-span"`; `to`: [`MilestoneKind`](MilestoneKind.md); \}

How a metric is computed from the gold model.

## Union Members

### Type Literal

\{ `kind`: `"simple"`; `measure`: [`MetricMeasure`](../interfaces/MetricMeasure.md); \}

#### kind

> `readonly` **kind**: `"simple"`

One measure.

#### measure

> `readonly` **measure**: [`MetricMeasure`](../interfaces/MetricMeasure.md)

The measure.

***

### Type Literal

\{ `denominator`: [`MetricMeasure`](../interfaces/MetricMeasure.md); `kind`: `"ratio"`; `numerator`: [`MetricMeasure`](../interfaces/MetricMeasure.md); `scale`: `number`; \}

#### denominator

> `readonly` **denominator**: [`MetricMeasure`](../interfaces/MetricMeasure.md)

Denominator.

#### kind

> `readonly` **kind**: `"ratio"`

`scale` times the numerator over the denominator, computed per group.
A zero denominator gives no value.

#### numerator

> `readonly` **numerator**: [`MetricMeasure`](../interfaces/MetricMeasure.md)

Numerator.

#### scale

> `readonly` **scale**: `number`

Multiplier: 1 for a fraction, 100 for a rate per 100.

***

### Type Literal

\{ `from`: [`MilestoneKind`](MilestoneKind.md); `kind`: `"milestone-span"`; `to`: [`MilestoneKind`](MilestoneKind.md); \}

#### from

> `readonly` **from**: [`MilestoneKind`](MilestoneKind.md)

Milestone the span starts at.

#### kind

> `readonly` **kind**: `"milestone-span"`

Whole days from one study milestone's actual date to another's, per
study, read from `gold.fct_milestone`. A study that has not reached
both milestones has no value.

#### to

> `readonly` **to**: [`MilestoneKind`](MilestoneKind.md)

Milestone the span ends at.
