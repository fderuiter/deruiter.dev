[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/lineage/model](../README.md) / LineageOrigin

# Type Alias: LineageOrigin

> **LineageOrigin** = \{ `kind`: `"result"`; `resultIds`: readonly `string`[]; \} \| \{ `dataset`: `string`; `kind`: `"record"`; `layer`: [`DataLayer`](../../../../types/type-aliases/DataLayer.md); `row`: `number`; \} \| \{ `activityId`: `string`; `kind`: `"activity"`; `visitId?`: `string`; \}

Where a trace starts.

## Union Members

### Type Literal

\{ `kind`: `"result"`; `resultIds`: readonly `string`[]; \}

#### kind

> `readonly` **kind**: `"result"`

One displayed table or figure cell: the results it shows.

#### resultIds

> `readonly` **resultIds**: readonly `string`[]

Ids of the ARS results, as a cell's `data-ars-results` lists them.

***

### Type Literal

\{ `dataset`: `string`; `kind`: `"record"`; `layer`: [`DataLayer`](../../../../types/type-aliases/DataLayer.md); `row`: `number`; \}

#### dataset

> `readonly` **dataset**: `string`

#### kind

> `readonly` **kind**: `"record"`

One record of a dataset in any layer.

#### layer

> `readonly` **layer**: [`DataLayer`](../../../../types/type-aliases/DataLayer.md)

#### row

> `readonly` **row**: `number`

Zero-based row index.

***

### Type Literal

\{ `activityId`: `string`; `kind`: `"activity"`; `visitId?`: `string`; \}

#### activityId

> `readonly` **activityId**: `string`

#### kind

> `readonly` **kind**: `"activity"`

One activity of the schedule of activities, at one visit or all.

#### visitId?

> `readonly` `optional` **visitId?**: `string`

The USDM encounter; every visit the activity is planned at when absent.
