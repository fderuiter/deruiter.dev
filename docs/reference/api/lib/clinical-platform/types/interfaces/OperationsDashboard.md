[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / OperationsDashboard

# Interface: OperationsDashboard

The operations dashboard at one scope, evaluated over one warehouse.

## Properties

### crumbs

> `readonly` **crumbs**: readonly [`OperationsCrumb`](OperationsCrumb.md)[]

Breadcrumb trail from the portfolio to the scope shown.

***

### dataCut

> `readonly` **dataCut**: `string`

ISO 8601 data cut of the warehouse.

***

### glance

> `readonly` **glance**: [`ReportData`](ReportData.md)

Headline numbers for the scope, from the registry.

***

### level

> `readonly` **level**: [`OperationsLevel`](../type-aliases/OperationsLevel.md)

***

### memberLevel

> `readonly` **memberLevel**: [`OperationsLevel`](../type-aliases/OperationsLevel.md) \| `null`

Level the members belong to, or `null` at a site, the deepest level.

***

### members

> `readonly` **members**: readonly [`OperationsMember`](OperationsMember.md)[]

Studies, countries or sites one level down, in id order.

***

### milestones

> `readonly` **milestones**: readonly [`OperationsMilestone`](OperationsMilestone.md)[] \| `null`

The study's milestones at the study level; `null` at every other level.

***

### notice

> `readonly` **notice**: `string` \| `null`

Why the scope asked for was cut back, or `null` when it was valid.

***

### runByOptions

> `readonly` **runByOptions**: readonly [`OperationsRunByOption`](OperationsRunByOption.md)[]

Run-by choices on the portfolio level; empty below it.

***

### scope

> `readonly` **scope**: [`OperationsScope`](OperationsScope.md)

The scope shown: the one asked for, cut back to its deepest valid level.

***

### sections

> `readonly` **sections**: readonly [`OperationsSection`](OperationsSection.md)[]

***

### study

> `readonly` **study**: [`OperationsStudyProfile`](OperationsStudyProfile.md) \| `null`

The study drilled into, or `null` at the portfolio level.
