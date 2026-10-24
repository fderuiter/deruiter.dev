[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/lineage/model](../README.md) / LineageScheduleEntry

# Interface: LineageScheduleEntry

One entry of the schedule of activities: an activity and the visits it is
planned at. `activityId` is `null` for a visit record, which belongs to the
encounter itself rather than to an activity.

## Properties

### activityId

> `readonly` **activityId**: `string` \| `null`

***

### activityName

> `readonly` **activityName**: `string` \| `null`

***

### basis

> `readonly` **basis**: `"visit"` \| `"schedule"`

`visit` when the collected record names its visit, `schedule` when the
record is not tied to one visit and every planned visit is listed.

***

### domain

> `readonly` **domain**: `string` \| `null`

SDTM domain of the activity's data.

***

### relation

> `readonly` **relation**: [`LineageRelation`](../type-aliases/LineageRelation.md)

`primary` when the activity collects the traced value itself, `linked`
when it collects a record the value only refers to, such as the first
dose date a study day counts from.

***

### visits

> `readonly` **visits**: readonly [`LineageVisit`](LineageVisit.md)[]
