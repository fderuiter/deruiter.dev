[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/doctor](../README.md) / checkSeoSocialIntegrity

# Function: checkSeoSocialIntegrity()

> **checkSeoSocialIntegrity**(`root`): [`DiagnosticCheckResult`](../interfaces/DiagnosticCheckResult.md)

Check SEO and social preview integrity (ADR 0053, #1256).

Reads `lib/seo-metadata.ts` as source so the check needs no module loading.
A rendered title is the route title plus the layout template
(" | Frederick de Ruiter", 22 characters). Fails when a rendered title is
outside 50 to 60 characters, a description is outside 140 to 160, a route
title carries the site name itself, the root viewport lacks the brand
theme color, or a registered route is missing from the llms manifests.

## Parameters

### root

`string`

Workspace root to inspect.

## Returns

[`DiagnosticCheckResult`](../interfaces/DiagnosticCheckResult.md)

The diagnostic result; never auto-fixable, since fixing copy is
an editorial change.
