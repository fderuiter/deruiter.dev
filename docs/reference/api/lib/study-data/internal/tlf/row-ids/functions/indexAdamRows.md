[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/row-ids](../README.md) / indexAdamRows

# Function: indexAdamRows()

> **indexAdamRows**(`datasets`): `ReadonlyMap`\<`string`, [`AdamRowLocation`](../../../../types/interfaces/AdamRowLocation.md)\>

Every row of the ADaM datasets, by row id.

## Parameters

### datasets

readonly [`Dataset`](../../../../types/interfaces/Dataset.md)[]

Datasets of a run; only the `adam` layer is indexed.

## Returns

`ReadonlyMap`\<`string`, [`AdamRowLocation`](../../../../types/interfaces/AdamRowLocation.md)\>

## Throws

RangeError when two rows share an id.
