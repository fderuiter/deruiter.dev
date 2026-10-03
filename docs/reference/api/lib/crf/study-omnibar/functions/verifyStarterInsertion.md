[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/study-omnibar](../README.md) / verifyStarterInsertion

# Function: verifyStarterInsertion()

> **verifyStarterInsertion**(`study`, `target`, `command`): `boolean`

Dry-runs a slash command against the target form through the same engine
operation the slash palette and canvas controls apply, and reports
whether it would produce a valid insertion: no engine error, at least one
inserted field, and no duplicate variable names in the resulting form.
Section layout commands only need an existing target form.

## Parameters

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

The current study, left unchanged.

### target

[`OmnibarInsertionTarget`](../interfaces/OmnibarInsertionTarget.md)

Form, and optionally section and position, to insert at.

### command

[`SlashCommandItem`](../../smart-blocks-engine/interfaces/SlashCommandItem.md)

The slash command to verify.

## Returns

`boolean`

True when the insertion is safe to offer.
