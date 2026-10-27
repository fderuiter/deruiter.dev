[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/plan](../README.md) / buildReportingPlan

# Function: buildReportingPlan()

> **buildReportingPlan**(`definition`): [`ReportingPlan`](../interfaces/ReportingPlan.md)

The reporting plan for a study: Table 14.1.1 (demographics, Safety Set),
Table 14.2.1 (systolic blood pressure change from baseline, Full Analysis
Set), Table 14.3.1 (TEAEs by system organ class and preferred term,
Safety Set), Figure 14.2.2 (Kaplan-Meier estimate of time to first TEAE
leading to discontinuation, Safety Set) and, when the study has a
comparator arm, Table 14.2.3 (win statistics for the hierarchical
composite, each other arm against the comparator, Full Analysis Set).
Treatment groups, visits and the days of the number-at-risk table come
from the study definition.

## Parameters

### definition

[`StudyDefinition`](../../../../types/interfaces/StudyDefinition.md)

## Returns

[`ReportingPlan`](../interfaces/ReportingPlan.md)
