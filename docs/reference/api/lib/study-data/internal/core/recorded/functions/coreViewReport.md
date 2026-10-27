[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/core/recorded](../README.md) / coreViewReport

# Function: coreViewReport()

> **coreViewReport**(`recorded`, `view`): [`CoreViewReport`](../interfaces/CoreViewReport.md)

CORE's findings for one view. A scenario view is recorded as its change to
the default view, so its counts are the default's plus what the scenario
adds and less what it removes; its examples come from the same change.

## Parameters

### recorded

[`RecordedFindings`](../interfaces/RecordedFindings.md)

### view

[`CoreView`](../type-aliases/CoreView.md)

## Returns

[`CoreViewReport`](../interfaces/CoreViewReport.md)
