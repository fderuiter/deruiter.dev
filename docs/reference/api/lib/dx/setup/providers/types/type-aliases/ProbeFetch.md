[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/dx/setup/providers/types](../README.md) / ProbeFetch

# Type Alias: ProbeFetch

> **ProbeFetch** = (`url`, `init`) => `Promise`\<\{ `ok`: `boolean`; `status`: `number`; `text`: `Promise`\<`string`\>; \}\>

Network access handed to a probe; tests pass a fake.

## Parameters

### url

`string`

### init

#### headers

`Record`\<`string`, `string`\>

#### method

`"GET"`

#### signal

`AbortSignal`

## Returns

`Promise`\<\{ `ok`: `boolean`; `status`: `number`; `text`: `Promise`\<`string`\>; \}\>
