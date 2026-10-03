[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/oss-credits/internal/notices](../README.md) / renderThirdPartyNotices

# Function: renderThirdPartyNotices()

> **renderThirdPartyNotices**(`sources`): `string`

Render third-party notices. Packages sharing the same license body are listed
together above one copy of the text, each with its own copyright lines, so the
file keeps every required notice while staying small. Output is deterministic.

## Parameters

### sources

[`NoticeSource`](../../../types/interfaces/NoticeSource.md)[]

## Returns

`string`
