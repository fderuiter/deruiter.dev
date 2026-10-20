[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/store](../README.md) / onArcadeProgressNotice

# Function: onArcadeProgressNotice()

> **onArcadeProgressNotice**(`listener`): () => `void`

Hears about stored values that could not be read and were set aside, once
per key per page. Notices raised before anyone listened are delivered on
subscribing. Returns the function that stops listening.

## Parameters

### listener

`NoticeListener`

Called with each notice.

## Returns

A function that removes the listener.

() => `void`
