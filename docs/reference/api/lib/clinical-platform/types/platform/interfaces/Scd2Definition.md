[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / Scd2Definition

# Interface: Scd2Definition

Slowly changing dimension type 2 settings of a dimension table.

## Properties

### isCurrent

> `readonly` **isCurrent**: `string`

Column flagging the latest version.

***

### naturalKey

> `readonly` **naturalKey**: `string`

Natural key column that identifies one member across its versions.

***

### trackedColumns

> `readonly` **trackedColumns**: readonly `string`[]

Columns whose change opens a new version.

***

### validFrom

> `readonly` **validFrom**: `string`

Column holding the first day a version is in force (inclusive).

***

### validTo

> `readonly` **validTo**: `string`

Column holding the day the next version takes over (exclusive).

***

### version

> `readonly` **version**: `string`

Column holding the version number, from 1.
