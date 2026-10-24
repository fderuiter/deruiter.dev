[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/stats](../README.md) / descriptiveStatistics

# Function: descriptiveStatistics()

> **descriptiveStatistics**(`values`, `rawDecimals?`): [`DescriptiveStatistics`](../../../../types/interfaces/DescriptiveStatistics.md)

n, mean, SD, median, minimum and maximum of some values.

The SD is the sample SD, with the n - 1 denominator, and is `null` when
there are fewer than two values. The median of an even count is the mean
of the two middle values. Every statistic except n is `null` when there
are no values.

## Parameters

### values

readonly `number`[]

Finite numbers, in any order.

### rawDecimals?

`number` = `...`

Decimals the values are recorded with. Inferred with
  [inferDecimalPlaces](inferDecimalPlaces.md) when omitted. Values are rounded to this
  precision before the statistics are computed.

## Returns

[`DescriptiveStatistics`](../../../../types/interfaces/DescriptiveStatistics.md)

## Throws

RangeError when a value is not finite or `rawDecimals` is not an
  integer from 0 to [MAX\_RAW\_DECIMALS](../variables/MAX_RAW_DECIMALS.md).
