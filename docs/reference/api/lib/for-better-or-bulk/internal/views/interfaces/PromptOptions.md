[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/views](../README.md) / PromptOptions

# Interface: PromptOptions

Options for one person's prompt.

## Properties

### touch?

> `readonly` `optional` **touch?**: `boolean`

True on a touch iPad (#2123): the idle partner's line names the dock's
Swap key instead of Tab.

***

### waiting?

> `readonly` `optional` **waiting?**: `boolean`

True for the idle partner in solo play, who is not at the keys. Their
prompt then has no buttons and a status that names the swap key. Ignored
on a helper day, where the partner is the helper's charge.
