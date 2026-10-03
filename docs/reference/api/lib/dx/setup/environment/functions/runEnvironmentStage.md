[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/environment](../README.md) / runEnvironmentStage

# Function: runEnvironmentStage()

> **runEnvironmentStage**(`options`): `Promise`\<[`EnvironmentStatus`](../../types/interfaces/EnvironmentStatus.md)\>

Creates or updates `.env.local` for a profile: copies the template when
the file is missing, generates `CRON_SECRET`, derives the unpooled
database URL, asks for required values the profile still lacks, then
reports template creation, schema validity and readiness separately.

## Parameters

### options

[`EnvironmentStageOptions`](../interfaces/EnvironmentStageOptions.md)

## Returns

`Promise`\<[`EnvironmentStatus`](../../types/interfaces/EnvironmentStatus.md)\>
