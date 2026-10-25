[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/portfolio/blueprint](../README.md) / StudyBlueprint

# Interface: StudyBlueprint

The full plan for one study: operations plus its protocol.

## Extends

- [`StudyOperationsPlan`](StudyOperationsPlan.md)

## Properties

### activationSpreadDays

> `readonly` **activationSpreadDays**: `number`

Days from start over which sites activate after the first.

#### Inherited from

[`StudyOperationsPlan`](StudyOperationsPlan.md).[`activationSpreadDays`](StudyOperationsPlan.md#activationspreaddays)

***

### annualBudgetUsd

> `readonly` **annualBudgetUsd**: `Readonly`\<`Record`\<`string`, `number`\>\>

Annual budget per vendor service, whole US dollars.

#### Inherited from

[`StudyOperationsPlan`](StudyOperationsPlan.md).[`annualBudgetUsd`](StudyOperationsPlan.md#annualbudgetusd)

***

### arms

> `readonly` **arms**: readonly `string`[]

***

### cecAdjudication

> `readonly` **cecAdjudication**: `boolean`

#### Inherited from

[`StudyOperationsPlan`](StudyOperationsPlan.md).[`cecAdjudication`](StudyOperationsPlan.md#cecadjudication)

***

### countries

> `readonly` **countries**: readonly `string`[]

Countries the sites are spread across, in allocation order.

#### Inherited from

[`StudyOperationsPlan`](StudyOperationsPlan.md).[`countries`](StudyOperationsPlan.md#countries)

***

### croVendorId

> `readonly` **croVendorId**: `string` \| `null`

#### Inherited from

[`StudyOperationsPlan`](StudyOperationsPlan.md).[`croVendorId`](StudyOperationsPlan.md#crovendorid)

***

### dropoutRate

> `readonly` **dropoutRate**: `number`

Share of enrolled subjects who discontinue before the last visit.

#### Inherited from

[`StudyOperationsPlan`](StudyOperationsPlan.md).[`dropoutRate`](StudyOperationsPlan.md#dropoutrate)

***

### enrollmentDays

> `readonly` **enrollmentDays**: `number`

Planned enrollment period, in days from first subject in.

#### Inherited from

[`StudyOperationsPlan`](StudyOperationsPlan.md).[`enrollmentDays`](StudyOperationsPlan.md#enrollmentdays)

***

### id

> `readonly` **id**: `string`

#### Inherited from

[`StudyOperationsPlan`](StudyOperationsPlan.md).[`id`](StudyOperationsPlan.md#id)

***

### monitoring

> `readonly` **monitoring**: [`MonitoringPlanTerms`](MonitoringPlanTerms.md)

The study's monitoring plan.

#### Inherited from

[`StudyOperationsPlan`](StudyOperationsPlan.md).[`monitoring`](StudyOperationsPlan.md#monitoring)

***

### operatingModel

> `readonly` **operatingModel**: [`OperatingModel`](../../../../types/platform/type-aliases/OperatingModel.md)

#### Inherited from

[`StudyOperationsPlan`](StudyOperationsPlan.md).[`operatingModel`](StudyOperationsPlan.md#operatingmodel)

***

### phase

> `readonly` **phase**: [`StudyPhase`](../../../../types/platform/type-aliases/StudyPhase.md)

#### Inherited from

[`StudyOperationsPlan`](StudyOperationsPlan.md).[`phase`](StudyOperationsPlan.md#phase)

***

### plannedEnrollment

> `readonly` **plannedEnrollment**: `number`

***

### plannedVisits

> `readonly` **plannedVisits**: readonly [`PlannedVisit`](../../../../types/platform/interfaces/PlannedVisit.md)[]

***

### productType

> `readonly` **productType**: [`ProductType`](../../../../types/platform/type-aliases/ProductType.md)

#### Inherited from

[`StudyOperationsPlan`](StudyOperationsPlan.md).[`productType`](StudyOperationsPlan.md#producttype)

***

### queryRate

> `readonly` **queryRate**: `number`

Mean EDC queries per entered visit.

#### Inherited from

[`StudyOperationsPlan`](StudyOperationsPlan.md).[`queryRate`](StudyOperationsPlan.md#queryrate)

***

### randomized

> `readonly` **randomized**: `boolean`

***

### scheduleSource

> `readonly` **scheduleSource**: `"usdm"` \| `"blueprint"`

***

### screenFailRate

> `readonly` **screenFailRate**: `number`

#### Inherited from

[`StudyOperationsPlan`](StudyOperationsPlan.md).[`screenFailRate`](StudyOperationsPlan.md#screenfailrate)

***

### siteCount

> `readonly` **siteCount**: `number`

#### Inherited from

[`StudyOperationsPlan`](StudyOperationsPlan.md).[`siteCount`](StudyOperationsPlan.md#sitecount)

***

### startOn

> `readonly` **startOn**: `string`

ISO 8601 protocol finalisation date.

#### Inherited from

[`StudyOperationsPlan`](StudyOperationsPlan.md).[`startOn`](StudyOperationsPlan.md#starton)

***

### studyDataProductId

> `readonly` **studyDataProductId**: `string` \| `null`

***

### studyDefinition

> `readonly` **studyDefinition**: [`StudyDefinition`](../../../../../study-data/types/interfaces/StudyDefinition.md) \| `null`

The Study Data Pipeline definition whose run supplies the study's
subjects and visits, or `null` when the portfolio simulates them.

***

### therapeuticArea

> `readonly` **therapeuticArea**: `string`

#### Inherited from

[`StudyOperationsPlan`](StudyOperationsPlan.md).[`therapeuticArea`](StudyOperationsPlan.md#therapeuticarea)

***

### title

> `readonly` **title**: `string`
