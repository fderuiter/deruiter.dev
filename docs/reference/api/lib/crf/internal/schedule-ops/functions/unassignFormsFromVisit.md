[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/schedule-ops](../README.md) / unassignFormsFromVisit

# Function: unassignFormsFromVisit()

> **unassignFormsFromVisit**(`study`, `visitIdOrName`, `formIdsOrDomains`): [`ScheduleOpResult`](../type-aliases/ScheduleOpResult.md)

Unbinds forms from a visit, named as for [assignFormsToVisit](assignFormsToVisit.md). A form
that is not bound to the visit is left as it is.

## Parameters

### study

[`StudyProtocol`](../../../types/interfaces/StudyProtocol.md)

### visitIdOrName

`string`

### formIdsOrDomains

readonly `string`[]

## Returns

[`ScheduleOpResult`](../type-aliases/ScheduleOpResult.md)
