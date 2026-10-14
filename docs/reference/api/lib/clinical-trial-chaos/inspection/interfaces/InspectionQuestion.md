[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/inspection](../README.md) / InspectionQuestion

# Interface: InspectionQuestion

## Properties

### answerNote

> **answerNote**: `string`

What the record actually shows, said after the answer.

***

### exhibit

> **exhibit**: `string`

Exhibit shown with the question: the record line or the email.

***

### id

> **id**: `string`

***

### kind

> **kind**: [`InspectionQuestionKind`](../type-aliases/InspectionQuestionKind.md)

***

### options

> **options**: [`InspectionOption`](InspectionOption.md)[]

***

### prompt

> **prompt**: `string`

***

### skeletonIndex?

> `optional` **skeletonIndex?**: `number`

Index into the run's skeletons, for a skeleton question.

***

### subjectLabel?

> `optional` **subjectLabel?**: `string`

The CRF asked about; absent for a skeleton question.

***

### timeLimitSeconds

> **timeLimitSeconds**: `number`
