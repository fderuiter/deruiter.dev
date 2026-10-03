[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/dx/setup/providers/publish](../README.md) / publishToDestination

# Function: publishToDestination()

> **publishToDestination**(`request`, `prompter`, `run`): `Promise`\<[`PublishOutcome`](../interfaces/PublishOutcome.md)\>

Publishes values to GitHub or Vercel, but only after every safeguard
passes: a person is present, the destination CLI is already signed in,
the Vercel environment is a real one, the person confirms the exact key
names and target, and a production target is confirmed a second time by
typing a fixed phrase. Values travel over stdin; summaries carry names.

## Parameters

### request

[`PublishRequest`](../interfaces/PublishRequest.md)

### prompter

[`SetupPrompter`](../../../prompts/interfaces/SetupPrompter.md)

### run

[`CommandRunner`](../type-aliases/CommandRunner.md)

## Returns

`Promise`\<[`PublishOutcome`](../interfaces/PublishOutcome.md)\>
