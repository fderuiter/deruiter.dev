[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/rbqm](../README.md) / StudyRiskAssessment

# Interface: StudyRiskAssessment

Risk-based quality management for one study at one data cut.

## Properties

### csm

> `readonly` **csm**: [`CsmRun`](CsmRun.md)

***

### dataCut

> `readonly` **dataCut**: `string`

ISO 8601 data cut of the warehouse.

***

### kris

> `readonly` **kris**: readonly [`KriAssessment`](KriAssessment.md)[]

Every KRI at every activated site, by site id then KRI order.

***

### log

> `readonly` **log**: readonly [`RiskSignalLogEntry`](RiskSignalLogEntry.md)[]

Signals raised at the data cut: red KRIs, QTL warnings and breaches, flagged sites.

***

### plan

> `readonly` **plan**: [`QualityPlan`](QualityPlan.md)

***

### qtls

> `readonly` **qtls**: readonly [`QtlAssessment`](QtlAssessment.md)[]

***

### studyId

> `readonly` **studyId**: `string`
