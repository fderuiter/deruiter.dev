[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/portfolio-dashboard](../README.md) / PortfolioMilestoneStatus

# Type Alias: PortfolioMilestoneStatus

> **PortfolioMilestoneStatus** = `"on-time"` \| `"late"` \| `"overdue"` \| `"upcoming"`

Where a milestone stands against its plan at the data cut (#2911):

- `on-time`: reached on or before its planned date;
- `late`: reached after its planned date;
- `overdue`: not reached, and its planned date is before the data cut;
- `upcoming`: not reached, and its planned date is on or after the data cut.

A late or overdue milestone has slipped.
