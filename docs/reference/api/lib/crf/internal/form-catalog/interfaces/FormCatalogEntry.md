[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/form-catalog](../README.md) / FormCatalogEntry

# Interface: FormCatalogEntry

One ready-made form or block in the catalog.

## Properties

### description

> **description**: `string`

***

### domain?

> `optional` **domain?**: `string`

The CDASH or SDTM domain code the entry collects, when it has one.

***

### fieldCount

> **fieldCount**: `number`

***

### id

> **id**: `string`

Stable within a catalog: the source followed by the source's own key.

***

### origin

> **origin**: `string`

Where the entry was found, e.g. "CDASHIG domain" or a preset's name.

***

### source

> **source**: [`FormCatalogSource`](../type-aliases/FormCatalogSource.md)

***

### target

> **target**: `"form"` \| `"visit"`

Forms are added to a visit; blocks are inserted into the open form.

***

### title

> **title**: `string`
