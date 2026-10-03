[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/doctor](../README.md) / checkSetupContractDocs

# Function: checkSetupContractDocs()

> **checkSetupContractDocs**(`root`, `onboardingFiles`): `string`[]

Keeps the setup documentation in step with the setup implementation.
Applies only to a workspace that ships `scripts/setup.sh`. Onboarding
pages must present the canonical command before any manual install
command, and `docs/reference/setup.md` must state the engines and
packageManager values from `package.json` verbatim, name every profile and
verification level, document the production override, and list the
database steps in the order the wizard runs them.

## Parameters

### root

`string`

### onboardingFiles

readonly `string`[]

## Returns

`string`[]
