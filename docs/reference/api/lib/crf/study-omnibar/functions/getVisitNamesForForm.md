[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/study-omnibar](../README.md) / getVisitNamesForForm

# Function: getVisitNamesForForm()

> **getVisitNamesForForm**(`study`, `formId`): `string`[]

Lists the names of the visits that collect a form, across the visit's
default assignments, its alternate `formIds` list and per-arm assignments.

## Parameters

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

The study to read.

### formId

`string`

The form to look up.

## Returns

`string`[]

Visit names in schedule order, without duplicates.
