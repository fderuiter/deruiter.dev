[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/environment](../README.md) / writeFileAtomic

# Function: writeFileAtomic()

> **writeFileAtomic**(`target`, `content`, `io?`): `void`

Writes `content` to `target` through a temporary file in the same
directory and a rename, so a crash or a failed write never leaves a
half-written `.env.local`. The file is created owner-readable only.

## Parameters

### target

`string`

### content

`string`

### io?

[`AtomicWriteIo`](../interfaces/AtomicWriteIo.md) = `nodeIo`

## Returns

`void`
