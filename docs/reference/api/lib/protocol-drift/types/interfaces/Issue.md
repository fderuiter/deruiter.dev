[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/protocol-drift/types](../README.md) / Issue

# Interface: Issue

A study issue tracked by the Issue Resolution FSM.

## Properties

### code

> **code**: [`IssueCode`](../type-aliases/IssueCode.md)

***

### detectedAtMinute

> **detectedAtMinute**: `number`

***

### evidence?

> `optional` **evidence?**: `string`

Evidence the player can attach to a query, if any.

***

### issueId

> **issueId**: `string`

***

### message

> **message**: `string`

***

### origin

> **origin**: [`IssueOrigin`](../type-aliases/IssueOrigin.md)

***

### pendingRevisionId?

> `optional` **pendingRevisionId?**: `string`

Source revision awaiting acceptance, from an amended record.

***

### resolution?

> `optional` **resolution?**: `string`

***

### scriptedStampOnGeneric?

> `optional` **scriptedStampOnGeneric?**: `boolean`

True for the scripted Wave 1 B01 Day 14 rubber-stamp lesson.

***

### siteId

> **siteId**: [`SiteId`](../type-aliases/SiteId.md)

***

### status

> **status**: [`IssueStatus`](../type-aliases/IssueStatus.md)

***

### subjectId

> **subjectId**: `string`

***

### submissionId

> **submissionId**: `string`

***

### targetField

> **targetField**: `string`

***

### visitDay

> **visitDay**: `number`
