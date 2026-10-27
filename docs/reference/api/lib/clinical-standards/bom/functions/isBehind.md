[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/bom](../README.md) / isBehind

# Function: isBehind()

> **isBehind**(`pinned`, `published`): `boolean`

Whether a pin is behind the newest published version, compared at the
precision of the pin, so a `2.1` pin is current against `2.1.11`.

## Parameters

### pinned

`string`

The pinned version.

### published

`string`

The newest published version.

## Returns

`boolean`

True when a newer version is published.
