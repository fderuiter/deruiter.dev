[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/usdm-v4-schedule](../README.md) / UsdmV4EncounterSchedule

# Interface: UsdmV4EncounterSchedule

Where one encounter sits in a USDM v4 schedule, in study-day terms.

## Properties

### activityIds

> **activityIds**: `string`[]

***

### encounterId

> **encounterId**: `string`

***

### epochId

> **epochId**: `string` \| `null`

***

### scheduledInstanceId

> **scheduledInstanceId**: `string`

***

### targetDay

> **targetDay**: `number` \| `null`

Planned study day, or `null` when no timing chain reaches the anchor.

***

### windowAfter

> **windowAfter**: `number`

Days the encounter may fall after `targetDay`.

***

### windowBefore

> **windowBefore**: `number`

Days the encounter may fall before `targetDay`.
