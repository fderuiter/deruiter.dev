[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/portfolio/start-up](../README.md) / startUpStages

# Function: startUpStages()

> **startUpStages**(`seed`, `study`, `sites`, `startDay`, `asOfDay`): `Map`\<`string`, [`StartUpDays`](../interfaces/StartUpDays.md)\>

Draws the start-up stages of a study's sites from a stream of their own,
so adding them moved no other generated value. The stages run backwards
from each site's planned activation: IRB approval comes before the
earliest day its initiation visit can fall, and no stage comes before
protocol finalisation. A site that activates soon after finalisation has
its gaps shortened in proportion to fit. A stage after the data cut has
not been reached, even for a site that never activates by then.

## Parameters

### seed

`number`

Portfolio seed.

### study

[`StudyBlueprint`](../../blueprint/interfaces/StudyBlueprint.md)

Study blueprint.

### sites

readonly [`SitePlan`](../../sites/interfaces/SitePlan.md)[]

The study's sites, in order.

### startDay

`number`

Day number of protocol finalisation.

### asOfDay

`number`

Day number of the data cut.

## Returns

`Map`\<`string`, [`StartUpDays`](../interfaces/StartUpDays.md)\>

Stage days by site id.
