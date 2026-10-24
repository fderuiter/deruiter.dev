[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/outputs](../README.md) / buildTlfOutputs

# Function: buildTlfOutputs()

> **buildTlfOutputs**(`definition`, `run`): [`TlfOutputs`](../../../../types/interfaces/TlfOutputs.md)

Runs the reporting plan against a pipeline run: Table 14.1.1
(demographic and baseline characteristics, Safety Set), Table 14.2.1
(systolic blood pressure, observed values and change from baseline by
visit, Full Analysis Set) and Table 14.3.1 (TEAEs by system organ class
and preferred term, Safety Set).

Analysis sets, groupings, data subsets, methods and analyses are declared
as data and returned in an ARS 1.0-shaped reporting event. Every result
records, through row sets, the ADaM rows it was computed from: the ADSL
rows of its population and the records it counted or summarised. Nothing
depends on the clock, so the same run always gives the same outputs.

## Parameters

### definition

[`StudyDefinition`](../../../../types/interfaces/StudyDefinition.md)

The study the run was made from; treatment groups and
  visits come from it.

### run

[`PipelineRun`](../../../../types/interfaces/PipelineRun.md)

A run from `runPipeline`.

## Returns

[`TlfOutputs`](../../../../types/interfaces/TlfOutputs.md)

The reporting event and the three tables.

## Throws

RangeError when the run is of another study, an ADaM dataset the
  plan reads is missing, or two ADaM rows share an id.
