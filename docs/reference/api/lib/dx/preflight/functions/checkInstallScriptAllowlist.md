[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/preflight](../README.md) / checkInstallScriptAllowlist

# Function: checkInstallScriptAllowlist()

> **checkInstallScriptAllowlist**(`root`): [`PreflightCheckResult`](../interfaces/PreflightCheckResult.md)

Verifies that package.json allowScripts matches scripts/install-script-allowlist.json
and that all third-party dependencies with install scripts are reviewed and allowlisted.

## Parameters

### root

`string`

## Returns

[`PreflightCheckResult`](../interfaces/PreflightCheckResult.md)
