[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/portfolio/sites](../README.md) / planSites

# Function: planSites()

> **planSites**(`seed`, `study`, `startDay`, `asOfDay`, `takenNames`): [`SitePlan`](../interfaces/SitePlan.md)[]

Plans the sites of one study.

## Parameters

### seed

`number`

Portfolio seed.

### study

[`StudyBlueprint`](../../blueprint/interfaces/StudyBlueprint.md)

Study blueprint.

### startDay

`number`

Day number of the study start.

### asOfDay

`number`

Day number of the data cut.

### takenNames

`Set`\<`string`\>

Site names already used in the portfolio; updated.

## Returns

[`SitePlan`](../interfaces/SitePlan.md)[]
