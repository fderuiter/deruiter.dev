[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/core/recorded](../README.md) / RecordedFindings

# Interface: RecordedFindings

The file `record` writes and the site reads (#2992).

## Properties

### $comment

> `readonly` **$comment**: `string`

***

### crf

> `readonly` **crf**: `Readonly`\<`Record`\<`string`, [`RecordedCrfPreset`](RecordedCrfPreset.md)\>\>

Every CRF Studio preset's USDM export, by preset id.

***

### explained

> `readonly` **explained**: `object`

Allowlist reasons by target, then by "CORE-id dataset".

#### sdtm

> `readonly` **sdtm**: `Readonly`\<`Record`\<`string`, [`RecordedExplanation`](RecordedExplanation.md)\>\>

#### usdm

> `readonly` **usdm**: `Readonly`\<`Record`\<`string`, [`RecordedExplanation`](RecordedExplanation.md)\>\>

***

### lock

> `readonly` **lock**: [`RecordedLock`](RecordedLock.md)

***

### rules

> `readonly` **rules**: `object`

#### sdtm

> `readonly` **sdtm**: `Readonly`\<`Record`\<`string`, [`RecordedRule`](RecordedRule.md)\>\>

#### usdm

> `readonly` **usdm**: `Readonly`\<`Record`\<`string`, [`RecordedRule`](RecordedRule.md)\>\>

***

### twins

> `readonly` **twins**: `Readonly`\<`Record`\<`string`, [`RecordedTwin`](RecordedTwin.md)\>\>

Local rule ids with the CORE rules measured to catch their defect.

***

### views

> `readonly` **views**: `object` & `Readonly`\<`Partial`\<`Record`\<[`ScenarioId`](../../../../types/type-aliases/ScenarioId.md), [`RecordedScenarioView`](RecordedScenarioView.md)\>\>\>

#### Type Declaration

##### default

> `readonly` **default**: [`RecordedDefaultView`](RecordedDefaultView.md)
