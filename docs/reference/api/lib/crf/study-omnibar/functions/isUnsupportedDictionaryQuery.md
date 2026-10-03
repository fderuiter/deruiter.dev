[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/study-omnibar](../README.md) / isUnsupportedDictionaryQuery

# Function: isUnsupportedDictionaryQuery()

> **isUnsupportedDictionaryQuery**(`query`): `boolean`

True when a query asks for licensed medical dictionary coding (MedDRA,
WHODrug). The studio has no dictionary lookup, so the omnibar explains
that instead of advertising a capability it does not have.

## Parameters

### query

`string`

Raw omnibar query text.

## Returns

`boolean`

Whether the query names an unavailable dictionary lookup.
