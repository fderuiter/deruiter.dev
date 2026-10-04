[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/oss-credits/internal/notices](../README.md) / listNoticedPackages

# Function: listNoticedPackages()

> **listNoticedPackages**(`notices`): `Map`\<`string`, `number`\>

Read a rendered notices file back: which `name@version` entries sit under a
license text, and how long that text is. A package listed only by identifier
has no body, so it does not appear here with a usable length.

## Parameters

### notices

`string`

## Returns

`Map`\<`string`, `number`\>
