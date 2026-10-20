[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / Study

# Interface: Study

One study in the portfolio.

## Properties

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

### productType

> `readonly` **productType**: [`ProductType`](../type-aliases/ProductType.md)

Investigational product type.

***

### regulatoryPath

> `readonly` **regulatoryPath**: `"IND"` \| `"IDE"`

US regulatory pathway: an IND for drugs and biologics, an IDE for devices.

***

### status

> `readonly` **status**: [`StudyStatus`](../type-aliases/StudyStatus.md)

Lifecycle status.

***

### studyDataProductId

> `readonly` **studyDataProductId**: `string` \| `null`

Id of the Study Data Pipeline data product that supplies this study's
SDTM and ADaM (ADR 0065), or `null` when the study has none.

***

### title

> `readonly` **title**: `string`

Short title.
