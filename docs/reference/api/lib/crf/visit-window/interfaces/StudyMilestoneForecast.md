[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/visit-window](../README.md) / StudyMilestoneForecast

# Interface: StudyMilestoneForecast

## Properties

### cohortSize

> **cohortSize**: `number`

***

### earliestStudyCompletionDate

> **earliestStudyCompletionDate**: `string`

Earliest overall study completion date (LSI + lastVisit earliest day)

***

### enrollmentDurationDays

> **enrollmentDurationDays**: `number`

***

### expectedAttritionRate

> **expectedAttritionRate**: `number`

***

### fsiDate

> **fsiDate**: `string`

First Subject In date

***

### fslvDate

> **fslvDate**: `string`

First Subject Last Visit target date (FSI + lastVisit.targetDay)

***

### latestStudyCompletionDate

> **latestStudyCompletionDate**: `string`

Latest overall study completion date (LSI + lastVisit latest day)

***

### lsiDate

> **lsiDate**: `string`

Last Subject In date (FSI + enrollmentDurationDays)

***

### lslvDate

> **lslvDate**: `string`

Last Subject Last Visit target date (LSI + lastVisit.targetDay)

***

### projectedCompletingSubjects

> **projectedCompletingSubjects**: `number`

Estimated completing subjects after attrition

***

### startDate

> **startDate**: `string`

***

### visitProjections

> **visitProjections**: [`VisitMilestoneProjection`](VisitMilestoneProjection.md)[]

Per-visit projections
