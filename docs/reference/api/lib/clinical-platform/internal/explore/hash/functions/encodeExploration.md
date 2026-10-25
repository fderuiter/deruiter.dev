[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/explore/hash](../README.md) / encodeExploration

# Function: encodeExploration()

> **encodeExploration**(`exploration`): `string`

Writes an exploration as a URL hash, without the leading `#`. The
exploration is normalized first, so equal explorations give equal links.

## Parameters

### exploration

[`Exploration`](../../../../types/explore/interfaces/Exploration.md)

The exploration.

## Returns

`string`

The hash.
