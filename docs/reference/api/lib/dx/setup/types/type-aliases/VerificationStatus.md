[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/types](../README.md) / VerificationStatus

# Type Alias: VerificationStatus

> **VerificationStatus** = `"not-checked"` \| `"configured"` \| `"schema-valid"` \| `"live-verified"` \| `"passed"` \| `"failed"`

The strongest claim a verification check can make, from weakest to
strongest: `configured` (a value is present), `schema-valid` (it has the
right shape), `live-verified` (a read-only call to the provider succeeded).
Commands report `passed`. `not-checked` means nobody asked for the check.
