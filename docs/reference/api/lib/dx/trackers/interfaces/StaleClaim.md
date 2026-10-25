[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/trackers](../README.md) / StaleClaim

# Interface: StaleClaim

A claim with no open PR and no push or comment inside the window.

## Properties

### holders

> **holders**: `string`[]

Assignee logins as `@login`, `lane:` labels, or "unassigned".

***

### issue

> **issue**: `number`

***

### lastActivityAt

> **lastActivityAt**: `string` \| `null`

The newer of the last push and the last comment, if either exists.

***

### title

> **title**: `string`
