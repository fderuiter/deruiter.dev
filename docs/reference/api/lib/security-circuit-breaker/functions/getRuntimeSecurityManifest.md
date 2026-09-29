[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/security-circuit-breaker](../README.md) / getRuntimeSecurityManifest

# Function: getRuntimeSecurityManifest()

> **getRuntimeSecurityManifest**(): [`SecurityManifest`](../interfaces/SecurityManifest.md)

Reads the runtime security manifest with sub-millisecond in-memory caching.
Evaluates filesystem updates when on disk, or falls back to static manifest.

## Returns

[`SecurityManifest`](../interfaces/SecurityManifest.md)
