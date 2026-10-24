[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/run-tags](../README.md) / noteRunView

# Function: noteRunView()

> **noteRunView**(`tags`, `view`): [`RunTags`](../interfaces/RunTags.md)

Records a view swap. A view never changes tuning, so the assists stay.

## Parameters

### tags

[`RunTags`](../interfaces/RunTags.md)

The run so far.

### view

[`FormFactor`](../../form-factor/type-aliases/FormFactor.md)

The view the run is now in.

## Returns

[`RunTags`](../interfaces/RunTags.md)

The record, or `tags` itself when the view was already in it.
