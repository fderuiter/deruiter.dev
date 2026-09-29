[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/download](../README.md) / DownloadFileOptions

# Interface: DownloadFileOptions

Options for [downloadFile](../functions/downloadFile.md).

## Properties

### mimeType?

> `optional` **mimeType?**: `string`

MIME type of the downloaded file. Defaults to the Blob's own type, to
`text/plain;charset=utf-8` for strings, and to `application/octet-stream`
for binary buffers. When set on a Blob whose type differs, the Blob is
re-wrapped with this type.

***

### revokeDelayMs?

> `optional` **revokeDelayMs?**: `number`

Milliseconds to wait after the click before revoking the object URL.
Defaults to [DEFAULT\_REVOKE\_DELAY\_MS](../variables/DEFAULT_REVOKE_DELAY_MS.md). Zero revokes synchronously;
negative or non-finite values fall back to the default.
