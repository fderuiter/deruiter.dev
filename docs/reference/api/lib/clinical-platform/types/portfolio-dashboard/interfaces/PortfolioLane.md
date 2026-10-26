[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/portfolio-dashboard](../README.md) / PortfolioLane

# Interface: PortfolioLane

One study's lane of the milestone swimlane (#2911).

## Properties

### milestones

> `readonly` **milestones**: readonly [`PortfolioMilestone`](PortfolioMilestone.md)[]

The study's milestones, in milestone order.

***

### operatingModel

> `readonly` **operatingModel**: `string`

`sponsor` or `cro`.

***

### productType

> `readonly` **productType**: `string`

`drug`, `biologic` or `device`.

***

### slipped

> `readonly` **slipped**: `number`

How many of its milestones are late or overdue.

***

### status

> `readonly` **status**: `string`

Study status at the data cut, for example `enrolling`.

***

### studyId

> `readonly` **studyId**: `string`

***

### title

> `readonly` **title**: `string`
