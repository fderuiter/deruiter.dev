[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/portfolio/blueprint](../README.md) / MonitoringPlanTerms

# Interface: MonitoringPlanTerms

What a study's monitoring plan sets. These are plan decisions, which
monitoring is measured against; they are not a regulatory standard.

## Properties

### interimIntervalDays

> `readonly` **interimIntervalDays**: `number`

Planned days from one monitoring visit at a site to the next interim visit.

***

### reportDueDays

> `readonly` **reportDueDays**: `number`

Days from a visit by which its report must be final.

***

### visitWindowDays

> `readonly` **visitWindowDays**: `number`

Days an interim visit may fall after its planned date and still be on time.
