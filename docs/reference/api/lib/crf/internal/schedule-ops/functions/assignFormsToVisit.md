[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/schedule-ops](../README.md) / assignFormsToVisit

# Function: assignFormsToVisit()

> **assignFormsToVisit**(`study`, `visitIdOrName`, `formIdsOrDomains`): [`ScheduleOpResult`](../type-aliases/ScheduleOpResult.md)

Binds forms to a visit. The visit is named by id or name, each form by id
or CDASH domain. Forms already bound stay where they are; an unknown visit
or form refuses the whole operation rather than binding the rest.

## Parameters

### study

[`StudyProtocol`](../../../types/interfaces/StudyProtocol.md)

### visitIdOrName

`string`

### formIdsOrDomains

readonly `string`[]

## Returns

[`ScheduleOpResult`](../type-aliases/ScheduleOpResult.md)
