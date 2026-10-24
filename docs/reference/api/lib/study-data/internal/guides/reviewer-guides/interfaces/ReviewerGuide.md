[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/guides/reviewer-guides](../README.md) / ReviewerGuide

# Interface: ReviewerGuide

One generated reviewer guide.

## Properties

### conformance

> `readonly` **conformance**: `object`

#### coreUrl

> `readonly` **coreUrl**: `string`

#### issues

> `readonly` **issues**: readonly [`ReviewerGuideIssue`](ReviewerGuideIssue.md)[]

#### rulesChecked

> `readonly` **rulesChecked**: `number`

#### rulesVersion

> `readonly` **rulesVersion**: `string`

#### scopeNotice

> `readonly` **scopeNotice**: `string`

#### status

> `readonly` **status**: `"warning"` \| `"failed"` \| `"pass"`

#### terminologyVersion

> `readonly` **terminologyVersion**: `string`

***

### dataFlow

> `readonly` **dataFlow**: readonly [`ReviewerGuideFlowStep`](ReviewerGuideFlowStep.md)[]

***

### datasets

> `readonly` **datasets**: readonly [`ReviewerGuideDataset`](ReviewerGuideDataset.md)[]

***

### derivations

> `readonly` **derivations**: readonly [`ReviewerGuideDerivation`](ReviewerGuideDerivation.md)[]

***

### kind

> `readonly` **kind**: [`ReviewerGuideKind`](../type-aliases/ReviewerGuideKind.md)

***

### notice

> `readonly` **notice**: `string`

***

### nSubjects

> `readonly` **nSubjects**: `number`

***

### outputs?

> `readonly` `optional` **outputs?**: readonly [`ReviewerGuideOutput`](ReviewerGuideOutput.md)[]

The ARS output index. ADRG only, and only when the reporting event was
passed to [buildReviewerGuides](../functions/buildReviewerGuides.md).

***

### scope

> `readonly` **scope**: `string`

What the guide covers and what it leaves out.

***

### seed

> `readonly` **seed**: `number`

***

### standards

> `readonly` **standards**: readonly `object`[]

***

### studyId

> `readonly` **studyId**: `string`

***

### title

> `readonly` **title**: `string`
