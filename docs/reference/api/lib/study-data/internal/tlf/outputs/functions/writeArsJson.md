[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/outputs](../README.md) / writeArsJson

# Function: writeArsJson()

> **writeArsJson**(`event`): `string`

Serialises a reporting event as ARS 1.0 JSON: two-space indentation and a
final newline. The fields that extend the ARS classes (the run's study,
seed, subject count, notice and standards, each result's id and row
references, each analysis's recorded decimals, and the row sets) are left
out, so the file validates against the ARS 1.0 schema; the synthetic-data
notice stays in the description. [writeArsLineageJson](writeArsLineageJson.md) writes the
rest. Key order follows the model, so the same event always gives the
same bytes.

## Parameters

### event

[`ArsReportingEvent`](../../../../types/interfaces/ArsReportingEvent.md)

## Returns

`string`
