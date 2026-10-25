[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/scaffold-game](../README.md) / scaffoldThreeViewGame

# Function: scaffoldThreeViewGame()

> **scaffoldThreeViewGame**(`root`, `names`, `dryRun?`): [`GameScaffoldFile`](../interfaces/GameScaffoldFile.md)[]

Scaffolds a three-view arcade game (ADR 0062, #2846): the game's files,
and its entries in the arcade registry, the arcade metadata, the progress
catalog and the discovery matrix. A registry that already lists the game
is left alone, and one whose list cannot be found is reported as skipped.

## Parameters

### root

`string`

The workspace root.

### names

[`GameScaffoldNames`](../interfaces/GameScaffoldNames.md)

The game's slug, component prefix and title.

### dryRun?

`boolean` = `false`

When true, nothing is written.

## Returns

[`GameScaffoldFile`](../interfaces/GameScaffoldFile.md)[]

Each file created and each registry updated or skipped.
