[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/crf-workloads](../README.md) / CrfWorkloadSpec

# Interface: CrfWorkloadSpec

Declarative size and shape of one synthetic workload.

## Properties

### fields

> **fields**: `number`

Total top-level fields across all forms (repeating-table columns are counted separately).

***

### forms

> **forms**: `number`

Number of forms in the study.

***

### id

> **id**: [`CrfWorkloadId`](../type-aliases/CrfWorkloadId.md)

***

### label

> **label**: `string`

***

### rulesPerForm

> **rulesPerForm**: `number`

Edit-check rules generated on each form.

***

### scenariosPerForm

> **scenariosPerForm**: `number`

Saved test scenarios generated on each form.

***

### scheduledVisits

> **scheduledVisits**: `number`

Scheduled visits, before the unscheduled and common (log) visits are added.

***

### seed

> **seed**: `number`

PRNG seed; changing it changes the generated document.
