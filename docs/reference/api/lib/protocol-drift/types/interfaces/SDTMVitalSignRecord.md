[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/protocol-drift/types](../README.md) / SDTMVitalSignRecord

# Interface: SDTMVitalSignRecord

A CDISC SDTM Vital Signs row.

## Properties

### DOMAIN

> **DOMAIN**: `"VS"`

***

### epistemicStatus

> **epistemicStatus**: [`EpistemicStatus`](../type-aliases/EpistemicStatus.md)

***

### EPOCH

> **EPOCH**: `"BASELINE"` \| `"TREATMENT"`

***

### insertedAtMinute

> **insertedAtMinute**: `number`

***

### lossNote?

> `optional` **lossNote?**: `string`

***

### pipelineRevisionId

> **pipelineRevisionId**: `string`

***

### precision

> **precision**: `number`

Decimal places used for display.

***

### protocolVersion

> **protocolVersion**: [`ProtocolVersion`](../type-aliases/ProtocolVersion.md)

Protocol version the visit was collected under.

***

### recordId

> **recordId**: `string`

***

### siteId

> **siteId**: [`SiteId`](../type-aliases/SiteId.md)

***

### sourceRevisionId

> **sourceRevisionId**: `string`

***

### STUDYID

> **STUDYID**: `"PD-101"`

***

### submissionId

> **submissionId**: `string`

***

### superseded

> **superseded**: `boolean`

***

### supersededBy?

> `optional` **supersededBy?**: `string`

***

### USUBJID

> **USUBJID**: `string`

***

### VISIT

> **VISIT**: `string`

***

### VISITNUM

> **VISITNUM**: `number`

***

### VSDTC

> **VSDTC**: `string`

***

### VSORRES

> **VSORRES**: `string`

***

### VSORRESU

> **VSORRESU**: `string`

***

### VSPOS

> **VSPOS**: [`VsPosition`](../type-aliases/VsPosition.md)

***

### VSSEQ

> **VSSEQ**: `number`

***

### VSSTRESC

> **VSSTRESC**: `string`

***

### VSSTRESN

> **VSSTRESN**: `number`

Unrounded standardized value; round only for display.

***

### VSSTRESU

> **VSSTRESU**: `string`

***

### VSTEST

> **VSTEST**: `"Systolic Blood Pressure"` \| `"Diastolic Blood Pressure"` \| `"Pulse Rate"`

***

### VSTESTCD

> **VSTESTCD**: [`VsTestCode`](../type-aliases/VsTestCode.md)
