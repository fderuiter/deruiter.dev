[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/shop](../README.md) / siteEnrollments

# Function: siteEnrollments()

> **siteEnrollments**(`site`, `effectiveAt`): `object`[]

The enrollment transitions a site produces: one ENROLL per subject, all
effective at `effectiveAt`, the study time the site went live.

## Parameters

### site

#### description

`string` = `...`

#### id

`string` = `identifier`

#### modifier

\{ `chips`: `number`; `label`: `string`; `plusMult`: `number`; `sourceId`: `string`; `xMult`: `number`; \} = `ScoreModifierSchema`

#### modifier.chips

`number` = `...`

#### modifier.label

`string` = `...`

#### modifier.plusMult

`number` = `...`

#### modifier.sourceId

`string` = `identifier`

#### modifier.xMult

`number` = `...`

#### name

`string` = `...`

#### subjects

`object`[] = `...`

The subjects the site enrolls. Their ids must be new to the study.

### effectiveAt

`string`

## Returns

`object`[]
