[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/media-storage](../README.md) / MediaStorageErrorCode

# Variable: MediaStorageErrorCode

> `const` **MediaStorageErrorCode**: `ZodEnum`\<\{ `DELETE_FAILED`: `"DELETE_FAILED"`; `READ_FAILED`: `"READ_FAILED"`; `STORAGE_UNCONFIGURED`: `"STORAGE_UNCONFIGURED"`; `UPLOAD_FAILED`: `"UPLOAD_FAILED"`; \}\>

Error codes returned by media storage providers (ADR 0028, ADR 0043).

`STORAGE_UNCONFIGURED` means no provider can serve this deployment, for
example a production or preview deployment without `BLOB_READ_WRITE_TOKEN`.
It fails closed instead of writing to ephemeral local disk. The remaining
codes are provider I/O failures.
