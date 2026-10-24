[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/define/build-define](../README.md) / buildDefine

# Function: buildDefine()

> **buildDefine**(`run`, `options`): [`DefineDocument`](../../model/interfaces/DefineDocument.md)

Builds the Define-XML 2.1 document model for the SDTM or ADaM datasets of
a pipeline run.

Every dataset of the layer becomes an ItemGroupDef and every variable an
ItemDef whose OID is the Dataset-JSON `itemOID`. Lengths are the longest
value in the data, as in the Dataset-JSON and XPT files. Codelists hold the
planned terms of the local terminology subset plus any value the data adds
to an extensible CDISC codelist, flagged as an extended value. VS, LB, ADVS
and ADLB get value-level metadata per parameter.

## Parameters

### run

[`PipelineRun`](../../../../types/interfaces/PipelineRun.md)

A pipeline run from `runPipeline`.

### options

[`DefineOptions`](../../model/interfaces/DefineOptions.md)

The layer and the creation timestamp.

## Returns

[`DefineDocument`](../../model/interfaces/DefineDocument.md)

The document model, for `writeDefineXml` and `renderDefineHtml`.

## Throws

RangeError when `createdAt` is not an ISO 8601 timestamp, the
  layer has no datasets, a dataset has no structure or an unknown class, a
  Derived variable names no method, a Collected or Predecessor variable
  names no source, a key variable has missing values, or a value falls
  outside a non-extensible codelist.
