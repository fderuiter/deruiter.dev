[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/export/xpt](../README.md) / writeXpt

# Function: writeXpt()

> **writeXpt**(`dataset`): [`XptResult`](../interfaces/XptResult.md)

Writes one dataset as a SAS XPORT v5 transport file.

## Parameters

### dataset

[`Dataset`](../../../../types/interfaces/Dataset.md)

An SDTM or ADaM dataset.

## Returns

[`XptResult`](../interfaces/XptResult.md)

The file bytes and any findings the format's limits raised.

## Throws

RangeError when a dataset or variable name is not a SAS name of
  at most 8 characters, the dataset has no variables or more than 9999,
  or a number is outside the IBM double range.

## Throws

TypeError when a value does not match its column.
