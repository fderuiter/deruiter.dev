[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/seo](../README.md) / getFAQPageNode

# Function: getFAQPageNode()

> **getFAQPageNode**(`items`, `pageUrl`): `Record`\<`string`, `unknown`\>

Returns a Schema.org `FAQPage` node for the given items. The items must be
the same ones rendered visibly on the page (Google's anti-cloaking rule).

## Parameters

### items

readonly [`FAQItem`](../interfaces/FAQItem.md)[]

### pageUrl

`string`

## Returns

`Record`\<`string`, `unknown`\>
