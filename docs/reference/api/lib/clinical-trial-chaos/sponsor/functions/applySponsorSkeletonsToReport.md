[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/sponsor](../README.md) / applySponsorSkeletonsToReport

# Function: applySponsorSkeletonsToReport()

> **applySponsorSkeletonsToReport**(`report`, `skeletons`, `dispositions?`, `chargedCount?`): [`BIMOInspectionReport`](../../types/interfaces/BIMOInspectionReport.md)

Surfaces the player's sponsor-pleasing shortcuts as inspection findings,
lowering the score and escalating the verdict where warranted.

## Parameters

### report

[`BIMOInspectionReport`](../../types/interfaces/BIMOInspectionReport.md)

The report to add the skeletons to.

### skeletons

readonly [`SponsorSkeleton`](../interfaces/SponsorSkeleton.md)[]

Sponsor-pleasing shortcuts taken.

### dispositions?

readonly [`SkeletonDisposition`](../type-aliases/SkeletonDisposition.md)[] = `[]`

How each skeleton was answered in the campaign-finale
  inspection, by index (#2089). Without one, a skeleton takes its full
  penalty at its own severity.

### chargedCount?

`number` = `0`

How many leading skeletons an earlier phase report
  already charged. They are not charged again: each adds only the finding
  its answer earns (none when disclosed, Minor for a wrong regulation or a
  timeout, Major for a denial).

## Returns

[`BIMOInspectionReport`](../../types/interfaces/BIMOInspectionReport.md)

The report with the skeleton findings applied.
