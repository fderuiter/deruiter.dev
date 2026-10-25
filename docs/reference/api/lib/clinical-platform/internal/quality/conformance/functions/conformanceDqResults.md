[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/quality/conformance](../README.md) / conformanceDqResults

# Function: conformanceDqResults()

> **conformanceDqResults**(`run`): [`DqRuleResult`](../../../../types/interfaces/DqRuleResult.md)[]

Results of the conformance rules on one pipeline run. A rule checks every
record of its dataset and fails the records its findings name; its status
is the pipeline gate's, so a warning stays a finding to review.

## Parameters

### run

[`PipelineRun`](../../../../../study-data/types/interfaces/PipelineRun.md)

## Returns

[`DqRuleResult`](../../../../types/interfaces/DqRuleResult.md)[]
