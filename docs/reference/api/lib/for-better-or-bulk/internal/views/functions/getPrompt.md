[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/views](../README.md) / getPrompt

# Function: getPrompt()

> **getPrompt**(`state`, `id`, `options?`): [`Prompt`](../interfaces/Prompt.md)

Button prompts and a status line for one person. `options.waiting` marks the
idle partner in solo play: their prompt then has no buttons and names the
swap key. It is ignored on a helper day, and it never changes an away or
frozen person's line.

## Parameters

### state

[`GameState`](../../../types/interfaces/GameState.md)

### id

[`PlayerId`](../../../types/type-aliases/PlayerId.md)

### options?

[`PromptOptions`](../interfaces/PromptOptions.md) = `{}`

## Returns

[`Prompt`](../interfaces/Prompt.md)
