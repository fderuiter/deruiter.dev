[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/validator](../README.md) / matchingEvents

# Function: matchingEvents()

> **matchingEvents**(`statistic`, `subject`): `object`[]

A subject's adverse events that match every filter on the row.

## Parameters

### statistic

#### kind

`"AE_SUBJECT_COUNT_PCT"` = `...`

#### ledToDiscontinuation?

`true` = `...`

#### minGrade?

`number` = `...`

#### serious?

`true` = `...`

#### soc?

`string` = `...`

#### term?

`string` = `...`

### subject

#### adverseEvents?

`object`[] = `...`

Treatment-emergent adverse events. Absent means none were reported.

#### age

`number` = `...`

#### arm

`"PLACEBO"` \| `"ACTIVE"` = `ArmSchema`

#### id

`string` = `identifier`

#### populations

(`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[] = `...`

#### sex

`"F"` \| `"M"` = `...`

## Returns

`object`[]
