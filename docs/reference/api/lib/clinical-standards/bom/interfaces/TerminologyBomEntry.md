[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/bom](../README.md) / TerminologyBomEntry

# Interface: TerminologyBomEntry

One NCI EVS CDISC terminology package the CT subset is derived from.

## Properties

### feed

> `readonly` **feed**: `string`

The current release's ODM-XML, whose header names its date.

***

### package

> `readonly` **package**: `"SDTM"` \| `"ADaM"` \| `"DDF"`

***

### pinned

> `readonly` **pinned**: `string`

The release the site's CT subset is derived from.

***

### published

> `readonly` **published**: `string`

The newest release NCI EVS publishes.

***

### status

> `readonly` **status**: `"current"` \| `"upgrade-available"`
