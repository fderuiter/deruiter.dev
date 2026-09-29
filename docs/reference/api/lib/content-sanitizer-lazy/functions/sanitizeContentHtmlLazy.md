[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/content-sanitizer-lazy](../README.md) / sanitizeContentHtmlLazy

# Function: sanitizeContentHtmlLazy()

> **sanitizeContentHtmlLazy**(`content`): `Promise`\<`string`\>

Sanitizes persisted editorial HTML like `sanitizeContentHtml`, but loads the
DOM sanitizer on first call instead of at module load. Services imported by
read-only routes (for example the sitemap) use this so the jsdom chain never
loads in the serverless bundle unless content is actually written (#1340).

## Parameters

### content

`string`

## Returns

`Promise`\<`string`\>
