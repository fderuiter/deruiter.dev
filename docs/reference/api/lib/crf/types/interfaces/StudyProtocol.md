[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/types](../README.md) / StudyProtocol

# Interface: StudyProtocol

## Properties

### $schema?

> `optional` **$schema?**: `string`

***

### arms?

> `optional` **arms?**: [`StudyArm`](StudyArm.md)[]

***

### auditLog?

> `optional` **auditLog?**: [`AuditTrailEntry`](AuditTrailEntry.md)[]

***

### auditTrail?

> `optional` **auditTrail?**: [`AuditTrailEntry`](AuditTrailEntry.md)[]

Protocol-level audit trail history across authoring and review lifecycle.

***

### biomedicalConcepts?

> `optional` **biomedicalConcepts?**: [`BiomedicalConcept`](BiomedicalConcept.md)[]

***

### branding?

> `optional` **branding?**: [`StudyBranding`](StudyBranding.md)

***

### codelists

> **codelists**: [`CodelistDefinition`](CodelistDefinition.md)[]

***

### cohorts?

> `optional` **cohorts?**: [`StudyCohort`](StudyCohort.md)[]

***

### epochs?

> `optional` **epochs?**: [`StudyEpoch`](StudyEpoch.md)[]

***

### forms

> **forms**: [`CRFForm`](CRFForm.md)[]

***

### id

> **id**: `string`

***

### lastModified

> **lastModified**: `string`

***

### phase

> **phase**: `"Phase I"` \| `"Phase I/II"` \| `"Phase II"` \| `"Phase III"` \| `"Phase IV"` \| `"Registry"`

***

### protocolId?

> `optional` **protocolId?**: `string`

***

### protocolNumber

> **protocolNumber**: `string`

***

### provenance?

> `optional` **provenance?**: [`StudyProvenance`](StudyProvenance.md)

***

### reviewThreads?

> `optional` **reviewThreads?**: [`StudyReviewThread`](StudyReviewThread.md)[]

Local authoring discussion and lifecycle history, separate from EDC audit data.

***

### rules?

> `optional` **rules?**: [`EditCheckRule`](EditCheckRule.md)[]

***

### schemaVersion?

> `optional` **schemaVersion?**: `string`

***

### simulationState?

> `optional` **simulationState?**: [`EdcSimulationState`](EdcSimulationState.md)

Document-level EDC simulation state (audit trail entries, electronic signatures, form values).

***

### sponsor

> **sponsor**: `string`

***

### studyName

> **studyName**: `string`

***

### testScenarios?

> `optional` **testScenarios?**: [`TestScenario`](TestScenario.md)[]

Named test scenarios and their last-run evidence (#677). Carried on the
study document rather than in browser storage so they survive native
export and reopen alongside everything else the study holds.

***

### therapeuticArea

> **therapeuticArea**: `string`

***

### title?

> `optional` **title?**: `string`

***

### version

> **version**: `string`

***

### visits

> **visits**: [`StudyVisit`](StudyVisit.md)[]
