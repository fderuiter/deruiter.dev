[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/governance/stewardship](../README.md) / stewardshipDomainOf

# Function: stewardshipDomainOf()

> **stewardshipDomainOf**(`role`, `domains?`): [`GovernanceDomainId`](../../../../types/type-aliases/GovernanceDomainId.md)

The domain an owner or steward role belongs to.

## Parameters

### role

`string`

An owner or steward role, as a product or metric names it.

### domains?

readonly [`GovernanceDomain`](../../../../types/interfaces/GovernanceDomain.md)[] = `GOVERNANCE_DOMAINS`

Domains to look in; defaults to `GOVERNANCE_DOMAINS`.

## Returns

[`GovernanceDomainId`](../../../../types/type-aliases/GovernanceDomainId.md)

The domain's id.

## Throws

Error when no domain holds the role.
