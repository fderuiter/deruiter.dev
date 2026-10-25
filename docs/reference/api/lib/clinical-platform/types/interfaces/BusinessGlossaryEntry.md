[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / BusinessGlossaryEntry

# Interface: BusinessGlossaryEntry

A business glossary term and the governed metrics that use it (#2638).

## Properties

### definition

> `readonly` **definition**: `string`

***

### key

> `readonly` **key**: `string`

Key in `CANONICAL_GLOSSARY`.

***

### metrics

> `readonly` **metrics**: readonly `string`[]

Ids of the metrics that link the term, in registry order.

***

### source

> `readonly` **source**: `string` \| `null`

The guideline or standard the definition follows, cited by reference, or `null`.

***

### synonyms

> `readonly` **synonyms**: readonly `string`[]

Other names for the term.

***

### term

> `readonly` **term**: `string`
