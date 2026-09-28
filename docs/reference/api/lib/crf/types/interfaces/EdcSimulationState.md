[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/types](../README.md) / EdcSimulationState

# Interface: EdcSimulationState

## Properties

### auditLog?

> `optional` **auditLog?**: [`AuditTrailEntry`](AuditTrailEntry.md)[]

***

### availableSubjects?

> `optional` **availableSubjects?**: `string`[]

***

### formValues?

> `optional` **formValues?**: `Record`\<`string`, `string` \| `number` \| `boolean` \| `null`\>

***

### lockedForms?

> `optional` **lockedForms?**: `Record`\<`string`, \{ `locked`: `boolean`; `lockedBy`: `string`; `timestamp`: `string`; \}\>

***

### queries?

> `optional` **queries?**: [`EDCQuery`](EDCQuery.md)[]

***

### sdvMap?

> `optional` **sdvMap?**: `Record`\<`string`, \{ `auditedBy`: `string`; `timestamp`: `string`; `verified`: `boolean`; \}\>

***

### signatures?

> `optional` **signatures?**: [`ElectronicSignature`](ElectronicSignature.md)[]
