[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/preflight](../README.md) / satisfiesVersionRange

# Function: satisfiesVersionRange()

> **satisfiesVersionRange**(`actual`, `range`): `boolean`

Evaluates a package.json `engines` range with npm semver semantics:
space-separated comparators that must all hold, `||` between
alternatives, x-ranges (`22.x`, `*`), and `^`/`~`. Pre-release tags are
ignored. `scripts/lib/setup-checks.sh` implements the same grammar for the
shell entrypoint, and a test runs both on the same cases.

## Parameters

### actual

`string`

### range

`string`

## Returns

`boolean`
