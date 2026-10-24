[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/lineage/trace](../README.md) / LineageIndex

# Interface: LineageIndex

Traces lineage within one pipeline run.

## Methods

### displayOf()

> **displayOf**(`resultId`): [`LineageDisplayCell`](../../model/interfaces/LineageDisplayCell.md) \| `undefined`

Where a result is displayed, when a table or figure shows it.

#### Parameters

##### resultId

`string`

#### Returns

[`LineageDisplayCell`](../../model/interfaces/LineageDisplayCell.md) \| `undefined`

***

### trace()

> **trace**(`origin`, `options?`): [`LineageTrace`](../../model/interfaces/LineageTrace.md)

Walks upstream and downstream from one starting point.

#### Parameters

##### origin

[`LineageOrigin`](../../model/type-aliases/LineageOrigin.md)

##### options?

[`LineageTraceOptions`](../../model/interfaces/LineageTraceOptions.md)

#### Returns

[`LineageTrace`](../../model/interfaces/LineageTrace.md)

#### Throws

RangeError when the start names a result, dataset, row,
  activity or visit the run does not have.
