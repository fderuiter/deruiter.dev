[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/term-glossary](../README.md) / TermDefinition

# Interface: TermDefinition

## Properties

### aliases?

> `optional` **aliases?**: `string`[]

***

### autoLink?

> `optional` **autoLink?**: `boolean`

Whether `compileTerms` wraps the term where it appears in prose. Defaults
to `true`. Business glossary terms such as "Enrollment" or "Query" are
ordinary words elsewhere on the site, so they set it to `false` and are
shown only where a page lists them.

***

### canonical

> **canonical**: `string`

***

### definition

> **definition**: `string`

***

### key

> **key**: `string`

***

### simplified

> **simplified**: `string`

***

### source?

> `optional` **source?**: `string`

The guideline or standard the definition follows, cited by reference
rather than quoted, or absent for an operational term no standard defines.
