[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/protocol-drift/types](../README.md) / ADaMVitalSignRecord

# Interface: ADaMVitalSignRecord

A derived ADVS row or a NOT EVALUABLE ledger entry.

## Properties

### ANL01FL

> **ANL01FL**: `"Y"` \| `"N"`

***

### AVAL

> **AVAL**: `number` \| `null`

Unrounded derived value; null when not evaluable.

***

### AVALC

> **AVALC**: `string`

Display value, or "NOT EVALUABLE".

***

### AVISIT

> **AVISIT**: `string`

***

### AVISITN

> **AVISITN**: `number`

***

### BASE

> **BASE**: `number` \| `null`

Sitting value; null when not evaluable.

***

### CHG

> **CHG**: `number` \| `null`

Standing minus sitting; null when not evaluable.

***

### CRIT1?

> `optional` **CRIT1?**: `"Orthostatic Hypotension"`

***

### CRIT1FL?

> `optional` **CRIT1FL?**: `"Y"` \| `"N"`

***

### derivationRule

> **derivationRule**: `"ORTHO_DELTA_V1"`

***

### marker

> **marker**: `"A"`

Authorized Assumption badge: derived by an approved rule.

***

### PARAM

> **PARAM**: `"Orthostatic Systolic Pressure Drop"` \| `"Orthostatic Diastolic Pressure Drop"` \| `"Orthostatic Assessment Status"`

***

### PARAMCD

> **PARAMCD**: [`AdvsParamCode`](../type-aliases/AdvsParamCode.md)

***

### precision

> **precision**: `number`

***

### reason?

> `optional` **reason?**: `string`

***

### rowId

> **rowId**: `string`

***

### sourceSittingRecordId

> **sourceSittingRecordId**: `string` \| `null`

***

### sourceStandingRecordId

> **sourceStandingRecordId**: `string` \| `null`

***

### stale

> **stale**: `boolean`

***

### STUDYID

> **STUDYID**: `"PD-101"`

***

### USUBJID

> **USUBJID**: `string`
