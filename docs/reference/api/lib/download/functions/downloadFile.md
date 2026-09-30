[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/download](../README.md) / downloadFile

# Function: downloadFile()

> **downloadFile**(`data`, `filename`, `options?`): `boolean`

Saves data to the user's device as a file named `filename`.

The temporary anchor is attached to the document before the click and
detached afterwards, even when the click throws. The object URL is revoked
after `revokeDelayMs` rather than synchronously, so the download is not
aborted in engines that resolve the URL asynchronously.

## Parameters

### data

[`DownloadData`](../type-aliases/DownloadData.md)

File contents: a Blob, a string, or a binary buffer.

### filename

`string`

Suggested file name for the download.

### options?

[`DownloadFileOptions`](../interfaces/DownloadFileOptions.md) = `{}`

Optional MIME type and revocation delay.

## Returns

`boolean`

True when the download was triggered; false when the runtime cannot download files (for example during SSR).
