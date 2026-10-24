[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / VariableMeta

# Interface: VariableMeta

Metadata attached to one variable (one column) of a dataset.

## Properties

### codelist?

> `readonly` `optional` **codelist?**: `string`

Id of the codelist in the pipeline's local terminology subset, for
example `NY` (CDISC CT, NCI code C66742) or a sponsor-defined list such
as `AEREL`. The codelist entry carries the NCI code; see
`CONTROLLED_TERMINOLOGY`.

***

### label

> `readonly` **label**: `string`

Variable label, at most 40 characters for XPT v5.

***

### length?

> `readonly` `optional` **length?**: `number`

Maximum length for text variables.

***

### method?

> `readonly` `optional` **method?**: `string`

Derivation method id, required when the origin is Derived.

***

### name

> `readonly` **name**: `string`

Variable name, for example `USUBJID` or `AVAL`.

***

### origin

> `readonly` **origin**: [`VariableOrigin`](../type-aliases/VariableOrigin.md)

Where the value comes from.

***

### role?

> `readonly` `optional` **role?**: [`VariableRole`](../type-aliases/VariableRole.md)

SDTM role. Omitted for ADaM and collected data.

***

### source?

> `readonly` `optional` **source?**: `string`

Source dataset and variable, required when the origin is Predecessor.

***

### type

> `readonly` **type**: [`VariableDataType`](../type-aliases/VariableDataType.md)

Data type as Define-XML declares it.
