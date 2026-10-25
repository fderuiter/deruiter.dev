[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/reporting](../README.md) / OperationsScope

# Interface: OperationsScope

Where the operations dashboard is drilled to (#2630). Each field narrows
the one before it: a country is read within the study, a site within the
study and country.

## Properties

### country?

> `readonly` `optional` **country?**: `string`

ISO 3166-1 alpha-2 country code of a country the study has sites in.

***

### runBy?

> `readonly` `optional` **runBy?**: `string`

Portfolio level only: who runs the studies shown, `sponsor` or a CRO's
vendor id. Absent shows every study.

***

### site?

> `readonly` `optional` **site?**: `string`

Site id, for example `DEMO-301-US-101`.

***

### study?

> `readonly` `optional` **study?**: `string`

Study id, for example `DEMO-301`.
