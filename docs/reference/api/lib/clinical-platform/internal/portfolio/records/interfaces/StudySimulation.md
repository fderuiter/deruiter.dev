[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/portfolio/records](../README.md) / StudySimulation

# Interface: StudySimulation

Records and enrollment facts produced for one study.

## Properties

### cec

> `readonly` **cec**: [`CecAdjudication`](../../../../types/interfaces/CecAdjudication.md)[]

***

### deviations

> `readonly` **deviations**: [`ProtocolDeviation`](../../../../types/interfaces/ProtocolDeviation.md)[]

***

### enrollDays

> `readonly` **enrollDays**: `number`[]

Enrollment day numbers, ascending.

***

### kits

> `readonly` **kits**: [`IrtKit`](../../../../types/interfaces/IrtKit.md)[]

***

### lastActivityBySite

> `readonly` **lastActivityBySite**: `Map`\<`string`, `number`\>

Last visit day per site id, for close-out timing.

***

### lastSubjectInDay

> `readonly` **lastSubjectInDay**: `number` \| `null`

Day the last subject was enrolled, or `null` while enrollment is open.

***

### lastSubjectLastVisitDay

> `readonly` **lastSubjectLastVisitDay**: `number` \| `null`

Day the last enrolled subject finished, or `null` while any is ongoing.

***

### queries

> `readonly` **queries**: [`EdcQuery`](../../../../types/interfaces/EdcQuery.md)[]

***

### randomizations

> `readonly` **randomizations**: [`IrtRandomization`](../../../../types/interfaces/IrtRandomization.md)[]

***

### subjects

> `readonly` **subjects**: [`EdcSubject`](../../../../types/interfaces/EdcSubject.md)[]

***

### visits

> `readonly` **visits**: [`EdcVisit`](../../../../types/interfaces/EdcVisit.md)[]
