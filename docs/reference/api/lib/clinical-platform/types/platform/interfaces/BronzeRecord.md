[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / BronzeRecord

# Interface: BronzeRecord

A raw record in a bronze feed, as received from its source system.

## Extends

- [`SyntheticRecord`](SyntheticRecord.md)

## Extended by

- [`EdcSubject`](EdcSubject.md)
- [`EdcVisit`](EdcVisit.md)
- [`EdcQuery`](EdcQuery.md)
- [`EdcAdverseEvent`](EdcAdverseEvent.md)
- [`CtmsMilestone`](CtmsMilestone.md)
- [`CtmsMonitoringPlan`](CtmsMonitoringPlan.md)
- [`CtmsMonitoringVisit`](CtmsMonitoringVisit.md)
- [`IrtRandomization`](IrtRandomization.md)
- [`IrtKit`](IrtKit.md)
- [`EtmfDocument`](EtmfDocument.md)
- [`FinanceLine`](FinanceLine.md)
- [`FinancePlanLine`](FinancePlanLine.md)
- [`SiteStaffAssignment`](SiteStaffAssignment.md)
- [`ProtocolDeviation`](ProtocolDeviation.md)
- [`CecAdjudication`](CecAdjudication.md)

## Properties

### source

> `readonly` **source**: [`SourceSystem`](../type-aliases/SourceSystem.md)

Source system the record was received from.

***

### synthetic

> `readonly` **synthetic**: `true`

Always `true`: the record is synthetic and describes nothing real.

#### Inherited from

[`SyntheticRecord`](SyntheticRecord.md).[`synthetic`](SyntheticRecord.md#synthetic)
