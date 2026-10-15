[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/protocol-drift/types](../README.md) / StudyPlan

# Interface: StudyPlan

Where a seed puts the study's authored puzzle beats and how its sites
behave (#2275). The default seed's plan is the authored study.

## Properties

### clarifications

> **clarifications**: `Readonly`\<`Record`\<`string`, `string`\>\>

Site answers that need no new source revision, by submission.

***

### initialGoodwill

> **initialGoodwill**: `Readonly`\<`Record`\<[`SiteId`](../type-aliases/SiteId.md), `number`\>\>

Each site's starting goodwill, which also sets its reply delay.

***

### lateBacklogDay

> **lateBacklogDay**: `number`

The trial day Site B keys its late Day 24 backlog (26 or 27).

***

### narrativeSubmissionId

> **narrativeSubmissionId**: `string`

The VS submission keyed as a free-text narrative with a repeat reading.

***

### partialDateSubmissionId

> **partialDateSubmissionId**: `string`

The MH submission whose start date is a partial ISO 8601 date.

***

### seed

> **seed**: `number`

***

### transpositionSubmissionId

> **transpositionSubmissionId**: `string`

The Site B systolic the fatigued backlog session transposes.

***

### worksheets

> **worksheets**: `Readonly`\<`Record`\<`string`, [`SourceWorksheet`](SourceWorksheet.md)\>\>

Worksheet scans by submission, for the transposition carrier.
