[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/types](../README.md) / IntegrationOutcome

# Interface: IntegrationOutcome

What the integrations stage did for one provider adapter.

## Properties

### detail

> **detail**: `string`

***

### provider

> **provider**: `string`

***

### published

> **published**: `string`[]

Destinations the user explicitly published to, e.g. `vercel:preview`.

***

### status

> **status**: `"skipped"` \| `"configured"` \| `"manual"` \| `"degraded"`

***

### written

> **written**: `string`[]

Key names written to `.env.local`; never values.
