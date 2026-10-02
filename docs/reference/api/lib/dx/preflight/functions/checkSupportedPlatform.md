[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/preflight](../README.md) / checkSupportedPlatform

# Function: checkSupportedPlatform()

> **checkSupportedPlatform**(`platform?`): [`PreflightCheckResult`](../interfaces/PreflightCheckResult.md)

Verifies the operating system is one this repository supports. Scripts,
Husky hooks, the git guardrail and several tests assume a POSIX shell and
POSIX tools (`bash`, `unzip`, `VAR=value` prefixes, `/` paths), and CI and
Vercel both run Linux. Native Windows is therefore unsupported; WSL 2
reports `linux` and passes (#939).

## Parameters

### platform?

`Platform` = `process.platform`

## Returns

[`PreflightCheckResult`](../interfaces/PreflightCheckResult.md)
