[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useWorkspaceAction](../README.md) / useWorkspaceAction

# Function: useWorkspaceAction()

> **useWorkspaceAction**(`action`): `void`

Registers a contextual workspace action on mount and automatically cleans up
the listener on unmount to prevent dangling handlers or memory leaks.

Each dispatch invokes the latest `action.handler`, so reading current state or
props inside the handler always sees fresh values.

## Parameters

### action

[`WorkspaceActionPayload`](../../../lib/event-bus/interfaces/WorkspaceActionPayload.md)

## Returns

`void`
