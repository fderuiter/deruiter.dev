[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/types](../README.md) / EnvKeyKind

# Type Alias: EnvKeyKind

> **EnvKeyKind** = `"secret"` \| `"public"` \| `"generated"` \| `"derived"` \| `"optional"` \| `"runtime-managed"`

What kind of value an environment key holds.

- `secret`: a credential the user supplies.
- `public`: safe to ship to the browser (`NEXT_PUBLIC_*`).
- `generated`: setup can create it locally (for example `CRON_SECRET`).
- `derived`: a provider integration fills it in from another value.
- `optional`: plain configuration with a working default.
- `runtime-managed`: set by a tool or platform at run time; never edited.
