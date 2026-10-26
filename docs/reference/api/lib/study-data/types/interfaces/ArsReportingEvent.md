[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ArsReportingEvent

# Interface: ArsReportingEvent

The reporting event: every analysis set, grouping, data subset, method,
analysis and output of a run, with the results. It holds no timestamps,
so the same study, seed and subject count give the same JSON. `notice`,
`studyId`, `seed`, `nSubjects`, `standards` and `rowSets` extend the
ARS 1.0 class: `writeArsJson` leaves them out, so the file validates
against the ARS 1.0 schema, and `writeArsLineageJson` writes them.

## Properties

### analyses

> `readonly` **analyses**: readonly [`ArsAnalysis`](ArsAnalysis.md)[]

Analyses, with their results.

***

### analysisGroupings

> `readonly` **analysisGroupings**: readonly [`ArsGroupingFactor`](ArsGroupingFactor.md)[]

Grouping factors.

***

### analysisSets

> `readonly` **analysisSets**: readonly [`ArsAnalysisSet`](../type-aliases/ArsAnalysisSet.md)[]

Populations.

***

### dataSubsets

> `readonly` **dataSubsets**: readonly [`ArsDataSubset`](../type-aliases/ArsDataSubset.md)[]

Record subsets.

***

### description

> `readonly` **description**: `string`

What the reporting event holds.

***

### id

> `readonly` **id**: `string`

Stable id, for example `RE_DEMO-301`.

***

### mainListOfContents

> `readonly` **mainListOfContents**: `object`

Outputs and the analyses each one displays.

#### contentsList

> `readonly` **contentsList**: `object`

##### contentsList.listItems

> `readonly` **listItems**: readonly [`ArsListItem`](ArsListItem.md)[]

#### name

> `readonly` **name**: `string`

***

### methods

> `readonly` **methods**: readonly [`ArsAnalysisMethod`](ArsAnalysisMethod.md)[]

Methods.

***

### name

> `readonly` **name**: `string`

Short name.

***

### notice

> `readonly` **notice**: `string`

The synthetic-data notice.

***

### nSubjects

> `readonly` **nSubjects**: `number`

Number of screened subjects in the run.

***

### outputs

> `readonly` **outputs**: readonly [`ArsOutput`](ArsOutput.md)[]

Outputs.

***

### rowSets

> `readonly` **rowSets**: readonly [`ArsRowSet`](ArsRowSet.md)[]

The ADaM row sets that results refer to.

***

### seed

> `readonly` **seed**: `number`

PRNG seed of the run.

***

### standards

> `readonly` **standards**: `Readonly`\<`Record`\<`"ARS"` \| `"ADaMIG"`, `string`\>\>

Pinned versions of the standards the model and data follow.

***

### studyId

> `readonly` **studyId**: `string`

Study identifier.

***

### terminologyExtensions

> `readonly` **terminologyExtensions**: readonly [`ArsTerminologyExtension`](ArsTerminologyExtension.md)[]

Sponsor terms the event uses where ARS terminology is extensible.

***

### version

> `readonly` **version**: `number`

Version, from 1.
