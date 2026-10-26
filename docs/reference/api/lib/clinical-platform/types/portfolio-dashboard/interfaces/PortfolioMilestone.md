[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/portfolio-dashboard](../README.md) / PortfolioMilestone

# Interface: PortfolioMilestone

One milestone of a study's lane, planned against actual (#2911).

## Extends

- [`OperationsMilestone`](../../reporting/interfaces/OperationsMilestone.md)

## Properties

### actual

> `readonly` **actual**: `string` \| `null`

ISO 8601 actual date, or `null` when not yet reached.

#### Inherited from

[`OperationsMilestone`](../../reporting/interfaces/OperationsMilestone.md).[`actual`](../../reporting/interfaces/OperationsMilestone.md#actual)

***

### kind

> `readonly` **kind**: [`MilestoneKind`](../../platform/type-aliases/MilestoneKind.md)

Milestone kind, for example `regulatory-approval`.

#### Overrides

[`OperationsMilestone`](../../reporting/interfaces/OperationsMilestone.md).[`kind`](../../reporting/interfaces/OperationsMilestone.md#kind)

***

### label

> `readonly` **label**: `string`

Label, for example `IDE approval` for a device study.

#### Inherited from

[`OperationsMilestone`](../../reporting/interfaces/OperationsMilestone.md).[`label`](../../reporting/interfaces/OperationsMilestone.md#label)

***

### overdueDays

> `readonly` **overdueDays**: `number` \| `null`

Days from the planned date to the data cut for an overdue milestone; `null` otherwise.

***

### planned

> `readonly` **planned**: `string`

ISO 8601 planned date.

#### Inherited from

[`OperationsMilestone`](../../reporting/interfaces/OperationsMilestone.md).[`planned`](../../reporting/interfaces/OperationsMilestone.md#planned)

***

### status

> `readonly` **status**: [`PortfolioMilestoneStatus`](../type-aliases/PortfolioMilestoneStatus.md)

***

### varianceDays

> `readonly` **varianceDays**: `number` \| `null`

Actual minus planned, in days; negative is early. `null` when not yet reached.

#### Inherited from

[`OperationsMilestone`](../../reporting/interfaces/OperationsMilestone.md).[`varianceDays`](../../reporting/interfaces/OperationsMilestone.md#variancedays)
