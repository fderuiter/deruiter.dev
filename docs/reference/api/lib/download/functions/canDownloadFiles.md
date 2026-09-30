[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/download](../README.md) / canDownloadFiles

# Function: canDownloadFiles()

> **canDownloadFiles**(): `boolean`

Whether the current runtime can trigger a browser file download: a DOM is
present and `URL.createObjectURL` is implemented. False during SSR and in
test environments such as JSDOM that do not implement object URLs.

## Returns

`boolean`
