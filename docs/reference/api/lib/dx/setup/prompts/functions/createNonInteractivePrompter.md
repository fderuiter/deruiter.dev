[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/prompts](../README.md) / createNonInteractivePrompter

# Function: createNonInteractivePrompter()

> **createNonInteractivePrompter**(`acceptDefaults?`): [`SetupPrompter`](../interfaces/SetupPrompter.md)

A prompter for agents, CI and `--yes`: never reads input. Confirmations
resolve to `false` unless the question's default is yes and `acceptDefaults`
is set, so a non-interactive run can never agree to a risky step on its own.

## Parameters

### acceptDefaults?

`boolean` = `false`

## Returns

[`SetupPrompter`](../interfaces/SetupPrompter.md)
