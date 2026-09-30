[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/media-storage](../README.md) / getMediaStorageProvider

# Function: getMediaStorageProvider()

> **getMediaStorageProvider**(): [`MediaStorageResult`](../type-aliases/MediaStorageResult.md)\<[`MediaStorageProvider`](../interfaces/MediaStorageProvider.md)\>

Resolves the active MediaStorageProvider from environment configuration.

A production or preview deployment without `BLOB_READ_WRITE_TOKEN` resolves
to `STORAGE_UNCONFIGURED` instead of falling back to ephemeral local disk.

## Returns

[`MediaStorageResult`](../type-aliases/MediaStorageResult.md)\<[`MediaStorageProvider`](../interfaces/MediaStorageProvider.md)\>
