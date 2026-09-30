[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/media-storage](../README.md) / MediaStorageErrorCode

# Type Alias: MediaStorageErrorCode

> **MediaStorageErrorCode** = `z.infer`\<*typeof* [`MediaStorageErrorCode`](../variables/MediaStorageErrorCode.md)\>

Error codes returned by media storage providers (ADR 0028, ADR 0043).

`STORAGE_UNCONFIGURED` means no provider can serve this deployment, for
example a production or preview deployment without `BLOB_READ_WRITE_TOKEN`.
It fails closed instead of writing to ephemeral local disk. The remaining
codes are provider I/O failures.
