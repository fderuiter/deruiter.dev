[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/types](../README.md) / SetupResult

# Interface: SetupResult

Full result of a setup run. Safe to print as JSON.

## Properties

### database

> **database**: [`DatabaseStatus`](DatabaseStatus.md) \| `null`

***

### dryRun

> **dryRun**: `boolean`

***

### environment

> **environment**: [`EnvironmentStatus`](EnvironmentStatus.md) \| `null`

***

### errors

> **errors**: `string`[]

***

### integrations

> **integrations**: [`IntegrationOutcome`](IntegrationOutcome.md)[]

***

### profile

> **profile**: `"local-minimal"` \| `"hosted-development"` \| `"deployment"`

***

### stages

> **stages**: [`SetupStageRecord`](SetupStageRecord.md)[]

***

### success

> **success**: `boolean`

***

### summary

> **summary**: `object`

#### completed

> **completed**: (`"dependencies"` \| `"database"` \| `"platform"` \| `"toolchain"` \| `"lockfile"` \| `"environment"` \| `"integrations"` \| `"verification"`)[]

#### failed

> **failed**: (`"dependencies"` \| `"database"` \| `"platform"` \| `"toolchain"` \| `"lockfile"` \| `"environment"` \| `"integrations"` \| `"verification"`)[]

#### manual

> **manual**: (`"dependencies"` \| `"database"` \| `"platform"` \| `"toolchain"` \| `"lockfile"` \| `"environment"` \| `"integrations"` \| `"verification"`)[]

#### skipped

> **skipped**: (`"dependencies"` \| `"database"` \| `"platform"` \| `"toolchain"` \| `"lockfile"` \| `"environment"` \| `"integrations"` \| `"verification"`)[]

***

### verification

> **verification**: [`VerificationCheck`](VerificationCheck.md)[]
