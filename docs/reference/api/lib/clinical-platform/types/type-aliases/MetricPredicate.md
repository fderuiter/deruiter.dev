[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / MetricPredicate

# Type Alias: MetricPredicate

> **MetricPredicate** = \{ `kind`: `"compare"`; `left`: [`MetricExpression`](MetricExpression.md); `operator`: [`MetricComparison`](MetricComparison.md); `right`: [`MetricExpression`](MetricExpression.md); \} \| \{ `column`: `string`; `kind`: `"in"`; `values`: readonly `string`[]; \} \| \{ `column`: `string`; `isNull`: `boolean`; `kind`: `"null"`; \}

A condition a row must meet to count towards a measure.

## Union Members

### Type Literal

\{ `kind`: `"compare"`; `left`: [`MetricExpression`](MetricExpression.md); `operator`: [`MetricComparison`](MetricComparison.md); `right`: [`MetricExpression`](MetricExpression.md); \}

#### kind

> `readonly` **kind**: `"compare"`

Compares two expressions. A `null` operand never matches.

#### left

> `readonly` **left**: [`MetricExpression`](MetricExpression.md)

Left operand.

#### operator

> `readonly` **operator**: [`MetricComparison`](MetricComparison.md)

Operator.

#### right

> `readonly` **right**: [`MetricExpression`](MetricExpression.md)

Right operand.

***

### Type Literal

\{ `column`: `string`; `kind`: `"in"`; `values`: readonly `string`[]; \}

#### column

> `readonly` **column**: `string`

Text column name.

#### kind

> `readonly` **kind**: `"in"`

Text column holds one of the listed values.

#### values

> `readonly` **values**: readonly `string`[]

Allowed values; never empty.

***

### Type Literal

\{ `column`: `string`; `isNull`: `boolean`; `kind`: `"null"`; \}

#### column

> `readonly` **column**: `string`

Column name.

#### isNull

> `readonly` **isNull**: `boolean`

`true` keeps rows where the column is `null`, `false` rows where it is not.

#### kind

> `readonly` **kind**: `"null"`

Column is, or is not, `null`.
