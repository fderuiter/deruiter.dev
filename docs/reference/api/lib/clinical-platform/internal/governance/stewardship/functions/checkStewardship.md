[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/governance/stewardship](../README.md) / checkStewardship

# Function: checkStewardship()

> **checkStewardship**(`model`): [`GovernanceFinding`](../../../../types/interfaces/GovernanceFinding.md)[]

Checks the stewardship model and the policies. Each role belongs to one
domain; every product and metric names an owner of some domain and a
steward of the same domain; each decision has exactly one accountable
role, at least one responsible role and a policy that exists; and each
policy has rules, a unique id and no compliance or validation claim.

## Parameters

### model

[`StewardshipModel`](../interfaces/StewardshipModel.md)

The products to check, and optionally the rest of the model.

## Returns

[`GovernanceFinding`](../../../../types/interfaces/GovernanceFinding.md)[]

Every broken rule; empty when the model is sound.
