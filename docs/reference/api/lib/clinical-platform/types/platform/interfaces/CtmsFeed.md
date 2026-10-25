[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / CtmsFeed

# Interface: CtmsFeed

The CTMS feed: milestones, monitoring visits and protocol deviations.

## Properties

### deviations

> `readonly` **deviations**: readonly [`ProtocolDeviation`](ProtocolDeviation.md)[]

Protocol deviations.

***

### milestones

> `readonly` **milestones**: readonly [`CtmsMilestone`](CtmsMilestone.md)[]

Study milestones.

***

### monitoringPlans

> `readonly` **monitoringPlans**: readonly [`CtmsMonitoringPlan`](CtmsMonitoringPlan.md)[]

Monitoring plans, one per study.

***

### monitoringVisits

> `readonly` **monitoringVisits**: readonly [`CtmsMonitoringVisit`](CtmsMonitoringVisit.md)[]

Monitoring visits.
