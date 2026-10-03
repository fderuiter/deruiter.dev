[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/protocol-drift/types](../README.md) / ChipConfig

# Interface: ChipConfig

Per-chip configuration. Only the keys a chip reads have meaning.

## Indexable

> \[`key`: `string`\]: `unknown`

## Properties

### joinKey?

> `optional` **joinKey?**: `"visit"` \| `"subject"`

PairAndDerive: join sitting and standing on visit or on subject only.

***

### partialDates?

> `optional` **partialDates?**: `"preserve"` \| `"impute-day"`

DateLocaleNormalizer: keep partial dates or impute a first day.

***

### routeBy?

> `optional` **routeBy?**: `"assessedAt"` \| `"submittedAt"`

AmendmentRouter: which timestamp decides applicability.
