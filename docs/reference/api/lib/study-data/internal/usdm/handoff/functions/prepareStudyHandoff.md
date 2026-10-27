[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/usdm/handoff](../README.md) / prepareStudyHandoff

# Function: prepareStudyHandoff()

> **prepareStudyHandoff**(`usdm`, `selection?`): [`StudyHandoff`](../interfaces/StudyHandoff.md)

Narrows a USDM v4 document to the activities and tests the pipeline can
generate, supplies a single arm and Screening/Treatment epochs when the
design has none, and reads the result into a `StudyDefinition`.

Activities whose SDTM domain the generator does not produce are listed as
not tabulated rather than failing the read. Within VS and LB, a concept is
kept only when its test is one the generator models; values are generated
in the modelled unit, and the report names the source unit when it differs.

## Parameters

### usdm

`unknown`

A parsed USDM v4.0 document, for example a CRF Studio export.

### selection?

[`UsdmStudySelection`](../../../../../clinical-standards/usdm-v4-selection/interfaces/UsdmStudySelection.md)

The study version and design to run, by id; needed when
  the document holds more than one of either.

## Returns

[`StudyHandoff`](../interfaces/StudyHandoff.md)

The runnable definition and the supported-domains report.

## Throws

StudyDefinitionError when the document is not a USDM v4 study or
  still fails to read after narrowing.
