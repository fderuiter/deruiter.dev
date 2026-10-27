[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ArsFileSpecification

# Interface: ArsFileSpecification

A file an output is rendered to.

## Properties

### fileType

> `readonly` **fileType**: [`ArsExtensibleTerm`](../type-aliases/ArsExtensibleTerm.md)

File type: the controlled term `rtf`, or a sponsor term for `html` and
`svg`, which ARS 1.0 does not list.

***

### location

> `readonly` **location**: `string`

Path relative to the output folder.

***

### name

> `readonly` **name**: `string`

File name.
