[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/study-omnibar](../README.md) / resolveOmnibarInsertionTarget

# Function: resolveOmnibarInsertionTarget()

> **resolveOmnibarInsertionTarget**(`study`, `formId`, `selectedFieldId?`): [`OmnibarInsertionTarget`](../interfaces/OmnibarInsertionTarget.md) \| `undefined`

Resolves where insert actions land, exactly as the slash palette does when
opened without an explicit target: directly after the selected field, or
else at the end of the form's first section.

## Parameters

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

The current study.

### formId

`string` \| `undefined`

The active form, if any.

### selectedFieldId?

`string` \| `null`

The selected field, if any.

## Returns

[`OmnibarInsertionTarget`](../interfaces/OmnibarInsertionTarget.md) \| `undefined`

The insertion target, or undefined when the form does not exist.
