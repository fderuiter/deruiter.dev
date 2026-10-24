[**fderuiter-portfolio**](../../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../../modules.md) / [lib/clinical-platform/internal/governance/contracts/evolution](../README.md) / checkContractChange

# Function: checkContractChange()

> **checkContractChange**(`previous`, `next`): [`DataContractFinding`](../../../../../types/interfaces/DataContractFinding.md)[]

Checks one version of a contract against the one before it: the version
may not go backwards, may not stay the same over a change, and must take
at least the bump the change needs, so a breaking change without a major
bump fails.

## Parameters

### previous

[`DataContract`](../../../../../types/interfaces/DataContract.md)

The earlier release.

### next

[`DataContract`](../../../../../types/interfaces/DataContract.md)

The release that follows it.

## Returns

[`DataContractFinding`](../../../../../types/interfaces/DataContractFinding.md)[]

Every broken versioning rule, each naming what changed.
