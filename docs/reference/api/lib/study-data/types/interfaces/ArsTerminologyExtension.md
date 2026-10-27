[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ArsTerminologyExtension

# Interface: ArsTerminologyExtension

The sponsor terms added to one extensible ARS enumeration.

## Properties

### enumeration

> `readonly` **enumeration**: `"AnalysisReasonEnum"` \| `"AnalysisPurposeEnum"` \| `"OperationRoleEnum"` \| `"OutputFileTypeEnum"`

The enumeration extended.

***

### id

> `readonly` **id**: `string`

Stable id, for example `TermExt_AnalysisPurpose`.

***

### sponsorTerms

> `readonly` **sponsorTerms**: readonly [`ArsSponsorTerm`](ArsSponsorTerm.md)[]

The terms added.
