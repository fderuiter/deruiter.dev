[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/usdm-handoff](../README.md) / UsdmHandoffStudy

# Interface: UsdmHandoffStudy

What the envelope says about the study it carries.

## Properties

### id

> `readonly` **id**: `string` \| `null`

`study.id`, which USDM v4 allows to be null.

***

### name

> `readonly` **name**: `string` \| `null`

`study.name`, or null when absent.

***

### usdmVersion

> `readonly` **usdmVersion**: `string` \| `null`

`usdmVersion` of the wrapper, or null when absent.

***

### versionIdentifiers

> `readonly` **versionIdentifiers**: readonly `string`[]

`versionIdentifier` of every study version, in document order.
