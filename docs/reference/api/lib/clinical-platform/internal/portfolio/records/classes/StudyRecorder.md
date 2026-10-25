[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/portfolio/records](../README.md) / StudyRecorder

# Class: StudyRecorder

Writes one study's bronze records, dropping anything after the data cut.

## Constructors

### Constructor

> **new StudyRecorder**(`study`, `rng`, `asOfDay`): `StudyRecorder`

#### Parameters

##### study

[`StudyBlueprint`](../../blueprint/interfaces/StudyBlueprint.md)

##### rng

[`Stream`](../../stream/classes/Stream.md)

##### asOfDay

`number`

#### Returns

`StudyRecorder`

## Properties

### cec

> `readonly` **cec**: [`CecAdjudication`](../../../../types/platform/interfaces/CecAdjudication.md)[] = `[]`

***

### deviations

> `readonly` **deviations**: [`ProtocolDeviation`](../../../../types/platform/interfaces/ProtocolDeviation.md)[] = `[]`

***

### kits

> `readonly` **kits**: [`IrtKit`](../../../../types/platform/interfaces/IrtKit.md)[] = `[]`

***

### lastActivityBySite

> `readonly` **lastActivityBySite**: `Map`\<`string`, `number`\>

***

### queries

> `readonly` **queries**: [`EdcQuery`](../../../../types/platform/interfaces/EdcQuery.md)[] = `[]`

***

### randomizations

> `readonly` **randomizations**: [`IrtRandomization`](../../../../types/platform/interfaces/IrtRandomization.md)[] = `[]`

***

### subjects

> `readonly` **subjects**: [`EdcSubject`](../../../../types/platform/interfaces/EdcSubject.md)[] = `[]`

***

### visits

> `readonly` **visits**: [`EdcVisit`](../../../../types/platform/interfaces/EdcVisit.md)[] = `[]`

## Methods

### addKit()

> **addKit**(`site`, `subjectId`, `dispensedDay`, `receivedDay`, `shelfMin`): `void`

Adds an IRT kit received by a site and, when given, dispensed.

#### Parameters

##### site

[`SitePlan`](../../sites/interfaces/SitePlan.md)

##### subjectId

`string` \| `null`

##### dispensedDay

`number` \| `null`

##### receivedDay

`number`

##### shelfMin

`number`

#### Returns

`void`

***

### addSiteStock()

> **addSiteStock**(`sites`): `void`

Adds undispensed stock at every active site, some past expiry.

#### Parameters

##### sites

readonly [`SitePlan`](../../sites/interfaces/SitePlan.md)[]

#### Returns

`void`

***

### deviate()

> **deviate**(`site`, `subjectId`, `type`, `occurredDay`): `void`

Adds a protocol deviation that occurred on a day; it is written only if
it was identified by the data cut.

#### Parameters

##### site

[`SitePlan`](../../sites/interfaces/SitePlan.md)

##### subjectId

`string`

##### type

[`DeviationType`](../interfaces/DeviationType.md)

##### occurredDay

`number`

#### Returns

`void`

***

### dispenseKit()

> **dispenseKit**(`site`, `subjectId`, `day`): `void`

Adds a kit dispensed at a visit, received some weeks before it.

#### Parameters

##### site

[`SitePlan`](../../sites/interfaces/SitePlan.md)

##### subjectId

`string`

##### day

`number`

#### Returns

`void`

***

### drawDeviations()

> **drawDeviations**(`site`, `subjectId`, `types`, `meanCount`, `enrollDay`, `endDay`): `void`

Draws a subject's deviations between enrollment and the end of
participation; under-reported at a site with a data integrity signal.

#### Parameters

##### site

[`SitePlan`](../../sites/interfaces/SitePlan.md)

##### subjectId

`string`

##### types

readonly [`DeviationType`](../interfaces/DeviationType.md)[]

##### meanCount

`number`

##### enrollDay

`number`

##### endDay

`number`

#### Returns

`void`

***

### missVisit()

> **missVisit**(`site`, `subjectId`, `plannedVisitId`): `void`

Adds a visit that did not take place.

#### Parameters

##### site

[`SitePlan`](../../sites/interfaces/SitePlan.md)

##### subjectId

`string`

##### plannedVisitId

`string`

#### Returns

`void`

***

### randomize()

> **randomize**(`site`, `subjectId`, `day`, `arm`): `void`

Adds an IRT randomisation on the enrollment day.

#### Parameters

##### site

[`SitePlan`](../../sites/interfaces/SitePlan.md)

##### subjectId

`string`

##### day

`number`

##### arm

`string`

#### Returns

`void`

***

### recordVisit()

> **recordVisit**(`site`, `subjectId`, `plannedVisitId`, `day`, `dayOffset`): `void`

Adds a visit with its data entry time and the queries raised on it.
A visit after the data cut is not written.

#### Parameters

##### site

[`SitePlan`](../../sites/interfaces/SitePlan.md)

##### subjectId

`string`

##### plannedVisitId

`string`

##### day

`number`

##### dayOffset

`number`

#### Returns

`void`

***

### touch()

> **touch**(`siteId`, `day`): `void`

Notes site activity on a day.

#### Parameters

##### siteId

`string`

##### day

`number`

#### Returns

`void`
