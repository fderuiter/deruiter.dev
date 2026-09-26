[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/package](../README.md) / PackageEvidence

# Interface: PackageEvidence

What the Card Table knows about one output in the package. `validation`
is null for an output with nothing to review (a face-only Table, a
Listing), or why it is not validated yet.

## Properties

### cardId

> **cardId**: `string`

***

### csrStage?

> `optional` **csrStage?**: `"DISPOSITION"` \| `"BASELINE"` \| `"EFFICACY"` \| `"SAFETY_AE"` \| `"PATIENT_LISTING"`

***

### name

> **name**: `string`

The output's short name, e.g. "Table 14.3.1".

***

### openFindings

> **openFindings**: [`PackageFinding`](PackageFinding.md)[]

Findings still open once every cell has been reviewed.

***

### stale

> **stale**: `boolean`

***

### validation

> **validation**: `string` \| `null`
