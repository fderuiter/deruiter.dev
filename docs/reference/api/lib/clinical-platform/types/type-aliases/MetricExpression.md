[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / MetricExpression

# Type Alias: MetricExpression

> **MetricExpression** = \{ `column`: `string`; `kind`: `"column"`; \} \| \{ `kind`: `"literal"`; `value`: `string` \| `number` \| `boolean`; \} \| \{ `column`: `string`; `kind`: `"date-of-key"`; \} \| \{ `kind`: `"data-cut"`; \} \| \{ `from`: `MetricExpression`; `kind`: `"days-between"`; `to`: `MetricExpression`; \}

A value computed from one row of a measure's table. Dates are whole days;
a gold date key (`YYYYMMDD`) is turned into a date with `date-of-key`.

## Union Members

### Type Literal

\{ `column`: `string`; `kind`: `"column"`; \}

#### column

> `readonly` **column**: `string`

Column name.

#### kind

> `readonly` **kind**: `"column"`

A column of the measure's table.

***

### Type Literal

\{ `kind`: `"literal"`; `value`: `string` \| `number` \| `boolean`; \}

#### kind

> `readonly` **kind**: `"literal"`

A constant.

#### value

> `readonly` **value**: `string` \| `number` \| `boolean`

Text, number or boolean value.

***

### Type Literal

\{ `column`: `string`; `kind`: `"date-of-key"`; \}

#### column

> `readonly` **column**: `string`

Date key column name.

#### kind

> `readonly` **kind**: `"date-of-key"`

The date a `YYYYMMDD` date key column stands for.

***

### Type Literal

\{ `kind`: `"data-cut"`; \}

#### kind

> `readonly` **kind**: `"data-cut"`

The data cut: the last day the warehouse describes.

***

### Type Literal

\{ `from`: `MetricExpression`; `kind`: `"days-between"`; `to`: `MetricExpression`; \}

#### from

> `readonly` **from**: `MetricExpression`

Start date.

#### kind

> `readonly` **kind**: `"days-between"`

Whole days from one date to another: `to` minus `from`.

#### to

> `readonly` **to**: `MetricExpression`

End date.
