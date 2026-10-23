[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/portfolio/blueprint](../README.md) / StudyOperationsPlan

# Interface: StudyOperationsPlan

The operational plan for one study, before the seed fills in operations.

## Extended by

- [`StudyBlueprint`](StudyBlueprint.md)

## Properties

### activationSpreadDays

> `readonly` **activationSpreadDays**: `number`

Days from start over which sites activate after the first.

***

### annualBudgetUsd

> `readonly` **annualBudgetUsd**: `Readonly`\<`Record`\<`string`, `number`\>\>

Annual budget per vendor service, whole US dollars.

***

### cecAdjudication

> `readonly` **cecAdjudication**: `boolean`

***

### countries

> `readonly` **countries**: readonly `string`[]

Countries the sites are spread across, in allocation order.

***

### croVendorId

> `readonly` **croVendorId**: `string` \| `null`

***

### dropoutRate

> `readonly` **dropoutRate**: `number`

Share of enrolled subjects who discontinue before the last visit.

***

### enrollmentDays

> `readonly` **enrollmentDays**: `number`

Planned enrollment period, in days from first subject in.

***

### id

> `readonly` **id**: `string`

***

### operatingModel

> `readonly` **operatingModel**: [`OperatingModel`](../../../../types/type-aliases/OperatingModel.md)

***

### phase

> `readonly` **phase**: [`StudyPhase`](../../../../types/type-aliases/StudyPhase.md)

***

### productType

> `readonly` **productType**: [`ProductType`](../../../../types/type-aliases/ProductType.md)

***

### queryRate

> `readonly` **queryRate**: `number`

Mean EDC queries per entered visit.

***

### screenFailRate

> `readonly` **screenFailRate**: `number`

***

### siteCount

> `readonly` **siteCount**: `number`

***

### startOn

> `readonly` **startOn**: `string`

ISO 8601 protocol finalisation date.

***

### therapeuticArea

> `readonly` **therapeuticArea**: `string`
