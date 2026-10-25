[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / CtmsMonitoringPlan

# Interface: CtmsMonitoringPlan

A study's monitoring plan as CTMS holds it: how often each active site
gets an interim monitoring visit, how far a visit may slip, and how soon
its report must be final. The values are the plan's own decisions, not a
regulatory standard.

## Extends

- [`BronzeRecord`](BronzeRecord.md)

## Properties

### effectiveOn

> `readonly` **effectiveOn**: `string`

ISO 8601 date the plan took effect.

***

### interimIntervalDays

> `readonly` **interimIntervalDays**: `number`

Planned days from one monitoring visit at a site to the next interim visit.

***

### monitoringPlanId

> `readonly` **monitoringPlanId**: `string`

Monitoring plan id.

***

### reportDueDays

> `readonly` **reportDueDays**: `number`

Days from a visit by which its report must be final.

***

### source

> `readonly` **source**: [`SourceSystem`](../type-aliases/SourceSystem.md)

Source system the record was received from.

#### Inherited from

[`BronzeRecord`](BronzeRecord.md).[`source`](BronzeRecord.md#source)

***

### studyId

> `readonly` **studyId**: `string`

Study id.

***

### synthetic

> `readonly` **synthetic**: `true`

Always `true`: the record is synthetic and describes nothing real.

#### Inherited from

[`BronzeRecord`](BronzeRecord.md).[`synthetic`](BronzeRecord.md#synthetic)

***

### version

> `readonly` **version**: `string`

Plan version.

***

### visitWindowDays

> `readonly` **visitWindowDays**: `number`

Days an interim visit may fall after its planned date and still be on time.
