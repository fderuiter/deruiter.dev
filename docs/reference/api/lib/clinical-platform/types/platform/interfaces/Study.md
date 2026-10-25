[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / Study

# Interface: Study

One study in the portfolio.

## Extends

- [`SyntheticRecord`](SyntheticRecord.md)

## Properties

### arms

> `readonly` **arms**: readonly `string`[]

Treatment arms, or the single open-label arm.

***

### cecAdjudication

> `readonly` **cecAdjudication**: `boolean`

Whether a clinical events committee adjudicates endpoint events.

***

### croVendorId

> `readonly` **croVendorId**: `string` \| `null`

Fictional vendor id of the CRO, when `operatingModel` is `cro`.

***

### id

> `readonly` **id**: `string`

Stable protocol id, for example `DEMO-301`.

***

### operatingModel

> `readonly` **operatingModel**: [`OperatingModel`](../type-aliases/OperatingModel.md)

Who runs the study.

***

### phase

> `readonly` **phase**: [`StudyPhase`](../type-aliases/StudyPhase.md)

Development phase or device study stage.

***

### plannedEnrollment

> `readonly` **plannedEnrollment**: `number`

Enrollment target across all sites.

***

### plannedVisits

> `readonly` **plannedVisits**: readonly [`PlannedVisit`](PlannedVisit.md)[]

Planned schedule of visits, screening first.

***

### productType

> `readonly` **productType**: [`ProductType`](../type-aliases/ProductType.md)

Investigational product type.

***

### randomized

> `readonly` **randomized**: `boolean`

Whether subjects are randomised through IRT.

***

### regulatoryPath

> `readonly` **regulatoryPath**: `"IND"` \| `"IDE"`

US regulatory pathway: an IND for drugs and biologics, an IDE for devices.

***

### scheduleSource

> `readonly` **scheduleSource**: `"usdm"` \| `"blueprint"`

Where the schedule comes from: the USDM study definition the Study Data
Pipeline runs, or the portfolio's own blueprint.

***

### startOn

> `readonly` **startOn**: `string`

ISO 8601 study start: the date the protocol was finalised.

***

### status

> `readonly` **status**: [`StudyStatus`](../type-aliases/StudyStatus.md)

Lifecycle status at the portfolio's data cut.

***

### studyDataProductId

> `readonly` **studyDataProductId**: `string` \| `null`

Id of the Study Data Pipeline data product that supplies this study's
SDTM and ADaM (ADR 0065), or `null` when the study has none.

***

### synthetic

> `readonly` **synthetic**: `true`

Always `true`: the record is synthetic and describes nothing real.

#### Inherited from

[`SyntheticRecord`](SyntheticRecord.md).[`synthetic`](SyntheticRecord.md#synthetic)

***

### therapeuticArea

> `readonly` **therapeuticArea**: `string`

Therapeutic area.

***

### title

> `readonly` **title**: `string`

Short title.
