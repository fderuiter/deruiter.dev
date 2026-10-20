[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/usdm-adapter](../README.md) / getUsdmDocumentVersion

# Function: getUsdmDocumentVersion()

> **getUsdmDocumentVersion**(`doc`): `"3"` \| `"4"`

Says which USDM generation a parsed document belongs to: `"4"` for a
USDM v4 Wrapper (a `usdmVersion` of 4.x, or a study holding `versions`),
otherwise `"3"`, which covers CRF Studio's pre-v4 graph and other flat
USDM-like JSON.

## Parameters

### doc

`unknown`

## Returns

`"3"` \| `"4"`
