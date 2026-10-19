[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/doctor](../README.md) / checkArcadeRegistryParity

# Function: checkArcadeRegistryParity()

> **checkArcadeRegistryParity**(`root`): [`DiagnosticCheckResult`](../interfaces/DiagnosticCheckResult.md)

Check Arcade Registry Discovery Parity (#2353, ADR 0062).

Every game route in `ARCADE_REGISTRY` (lib/arcade/registry.ts) must also be
in the route metadata that feeds the sitemap (`ROUTE_METADATA_CONFIGS`), the
public route registry that feeds `CANONICAL_ROUTES`, and the Command
Palette's `staticNavs`, so a game cannot be listed in one place and missing
from another.

## Parameters

### root

`string`

## Returns

[`DiagnosticCheckResult`](../interfaces/DiagnosticCheckResult.md)
