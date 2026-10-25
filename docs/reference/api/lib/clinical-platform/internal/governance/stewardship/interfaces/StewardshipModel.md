[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/governance/stewardship](../README.md) / StewardshipModel

# Interface: StewardshipModel

What `checkStewardship` checks; every field defaults to the platform's own.

## Properties

### decisions?

> `readonly` `optional` **decisions?**: readonly [`GovernanceDecision`](../../../../types/governance/interfaces/GovernanceDecision.md)[]

***

### domains?

> `readonly` `optional` **domains?**: readonly [`GovernanceDomain`](../../../../types/governance/interfaces/GovernanceDomain.md)[]

***

### metrics?

> `readonly` `optional` **metrics?**: readonly [`MetricDefinition`](../../../../types/platform/interfaces/MetricDefinition.md)[]

***

### policies?

> `readonly` `optional` **policies?**: readonly [`GovernancePolicy`](../../../../types/governance/interfaces/GovernancePolicy.md)[]

***

### products

> `readonly` **products**: readonly [`DataProduct`](../../../../types/platform/interfaces/DataProduct.md)[]
