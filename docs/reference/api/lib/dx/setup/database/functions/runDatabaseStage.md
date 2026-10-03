[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/database](../README.md) / runDatabaseStage

# Function: runDatabaseStage()

> **runDatabaseStage**(`options`): `Promise`\<[`DatabaseStatus`](../../types/interfaces/DatabaseStatus.md)\>

Generates the Prisma client, then (each step asked separately) applies
the schema and seeds sample data. Refuses both mutations on a production
target unless `allowProductionHost` names that exact host and a person
confirms it. Every step records whether it ran and how to recover it.

## Parameters

### options

[`DatabaseStageOptions`](../interfaces/DatabaseStageOptions.md)

## Returns

`Promise`\<[`DatabaseStatus`](../../types/interfaces/DatabaseStatus.md)\>
