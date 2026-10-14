[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / InspectionReportOptions

# Interface: InspectionReportOptions

Extra inputs to `buildInspectionReport`.

## Properties

### chargedSkeletons?

> `optional` **chargedSkeletons?**: `number`

How many leading `skeletons` earlier phase reports already charged. The
finale adds only the finding each one's answer earns (#2089).

***

### inspection?

> `optional` **inspection?**: [`InspectionRound`](../../inspection/interfaces/InspectionRound.md)

The finished campaign-finale inspection (#2089). Its skeleton answers set
each skeleton's penalty and its record answers add interview findings.

***

### now?

> `optional` **now?**: `Date`

When the report is filed; fix it to make the report repeatable.
