[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/env](../README.md) / buildTimestamp

# Function: buildTimestamp()

> **buildTimestamp**(): `string` \| `null`

When this build ran, as an ISO 8601 timestamp, or null outside a build.

`next.config.ts` sets `BUILD_TIMESTAMP` in its `env` block, so Next inlines
the value into the bundle at build time. It is not a deployment variable and
is not in the schema. Tests and `next dev` see null.

## Returns

`string` \| `null`
