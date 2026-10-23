[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/synth/generate-collected-data](../README.md) / generateCollectedData

# Function: generateCollectedData()

> **generateCollectedData**(`definition`, `options`): readonly [`Dataset`](../../../../types/interfaces/Dataset.md)[]

Generates CDASH-shaped source datasets. `nSubjects` counts screened people;
only randomized people have RAND and EX records. Every stochastic choice is
keyed by study, seed, subject, domain and field, so extending a run preserves
all previously generated subjects byte for byte.

## Parameters

### definition

[`StudyDefinition`](../../../../types/interfaces/StudyDefinition.md)

### options

[`PipelineOptions`](../../../../types/interfaces/PipelineOptions.md)

## Returns

readonly [`Dataset`](../../../../types/interfaces/Dataset.md)[]
