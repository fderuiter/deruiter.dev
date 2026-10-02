[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/seed](../README.md) / Challenge

# Interface: Challenge

What a challenge link carries.

## Properties

### customScenario?

> `optional` **customScenario?**: `object`

An encoded custom scenario specification, if present.

#### cardIds

> **cardIds**: `string`[]

#### events?

> `optional` **events?**: `object`[]

#### id?

> `optional` **id?**: `string`

#### intro?

> `optional` **intro?**: `string`

#### quota

> **quota**: `number`

#### rulebook

> **rulebook**: `object`

##### rulebook.meanPrecision

> **meanPrecision**: `number`

##### rulebook.percentPrecision

> **percentPrecision**: `number`

##### rulebook.populationSuit?

> `optional` **populationSuit?**: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`

##### rulebook.roundingMode

> **roundingMode**: `"HALF_EVEN"` \| `"HALF_AWAY_FROM_ZERO"` \| `"TRUNCATE"` = `RoundingModeSchema`

#### startingCpu

> **startingCpu**: `number`

#### summary?

> `optional` **summary?**: `string`

#### title

> **title**: `string`

***

### daily

> **daily**: `string` \| `null`

Set when the link is a Daily Protocol run, and only if the seed is that day's.

***

### seed

> **seed**: `string`

***

### sponsorId?

> `optional` **sponsorId?**: `"VIRTUAL_BIOTECH"` \| `"ONCOLOGY_PHARMA"` \| `"CARDIO_MEGA_TRIAL"` \| `"RARE_DISEASE_BIOTECH"`

The run's sponsor (#950). Absent means Virtual Biotech.

***

### stake?

> `optional` **stake?**: `number`

The run's stake (#950). Absent means stake 1.
