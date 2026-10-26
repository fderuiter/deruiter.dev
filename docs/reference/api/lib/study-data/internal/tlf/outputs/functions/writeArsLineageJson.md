[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/outputs](../README.md) / writeArsLineageJson

# Function: writeArsLineageJson()

> **writeArsLineageJson**(`event`): `string`

Serialises what [writeArsJson](writeArsJson.md) leaves out, as JSON: the run (study,
seed, subject count, notice and standards), each analysis's recorded
decimals, and for each result, found by its analysis and its zero-based
position in that analysis's results, its id and the ADaM row sets it was
computed from. With the ARS file it gives back the whole reporting event.

## Parameters

### event

[`ArsReportingEvent`](../../../../types/interfaces/ArsReportingEvent.md)

## Returns

`string`
