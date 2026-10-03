[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/chips](../README.md) / routeAmendment

# Function: routeAmendment()

> **routeAmendment**(`input`, `activationMinute`, `routeBy?`): [`RouterDecision`](../interfaces/RouterDecision.md)

AmendmentRouter: the applicable version is v2 when the routing timestamp is
on or after the site's activation, else v1. The routing timestamp is the
assessment date unless the chip is misconfigured to use submission time.
A form that does not match the applicable version goes to review.

## Parameters

### input

[`RouterInput`](../interfaces/RouterInput.md)

### activationMinute

`number`

### routeBy?

`"assessedAt"` \| `"submittedAt"`

## Returns

[`RouterDecision`](../interfaces/RouterDecision.md)
