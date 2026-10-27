[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/terminology](../README.md) / TerminologyCodelist

# Interface: TerminologyCodelist

One codelist of the local terminology subset.

## Properties

### extensible

> `readonly` **extensible**: `boolean`

Whether values outside `terms` are allowed. They are written to
Define-XML as extended values. A value outside a non-extensible codelist
is an error.

***

### fromData?

> `readonly` `optional` **fromData?**: `true`

When set, the terms are read from the data instead: every value of the
coded variable, with its decode taken from the paired variable named in
`DECODE_VARIABLES`. Used for sponsor lists such as arm and parameter
codes, whose terms the study design defines.

***

### id

> `readonly` **id**: `string`

Codelist id, the value of `VariableMeta.codelist`, for example `NY`.

***

### name

> `readonly` **name**: `string`

Codelist name.

***

### nciCode?

> `readonly` `optional` **nciCode?**: `string`

NCI code of the codelist, for CDISC codelists.

***

### publishingSet?

> `readonly` `optional` **publishingSet?**: `"SDTM"` \| `"ADaM"`

The CDISC CT publishing set the codelist belongs to. Absent for a
sponsor-defined codelist.

***

### terms

> `readonly` **terms**: readonly [`TerminologyTerm`](TerminologyTerm.md)[]

The planned terms, in display order.
