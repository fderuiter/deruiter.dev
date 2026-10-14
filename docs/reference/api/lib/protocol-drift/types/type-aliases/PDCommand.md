[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/protocol-drift/types](../README.md) / PDCommand

# Type Alias: PDCommand

> **PDCommand** = \{ `rejectedCommands?`: `number`; `scenario?`: [`ScenarioId`](ScenarioId.md); `seed`: `number`; `type`: `"INIT"`; \} \| \{ `type`: `"ACCEPT_BRIEF"`; \} \| \{ `speed`: [`SimSpeed`](SimSpeed.md); `type`: `"SET_SPEED"`; \} \| \{ `isPaused`: `boolean`; `type`: `"SET_PAUSED"`; \} \| \{ `type`: `"STEP_TICK"`; \} \| \{ `realMs`: `number`; `type`: `"TICK"`; \} \| \{ `minute`: `number`; `type`: `"ADVANCE_TO"`; \} \| \{ `edges`: [`CanvasEdge`](../interfaces/CanvasEdge.md)[]; `nodes`: [`CanvasNode`](../interfaces/CanvasNode.md)[]; `type`: `"LOAD_GRAPH"`; \} \| \{ `edges`: [`CanvasEdge`](../interfaces/CanvasEdge.md)[]; `nodes`: [`CanvasNode`](../interfaces/CanvasNode.md)[]; `type`: `"VALIDATE_GRAPH"`; \} \| \{ `edges`: [`CanvasEdge`](../interfaces/CanvasEdge.md)[]; `nodes`: [`CanvasNode`](../interfaces/CanvasNode.md)[]; `revisionId`: `string`; `type`: `"PUBLISH_REVISION"`; \} \| \{ `evidenceLinked`: `boolean`; `issueId`: `string`; `message?`: `string`; `type`: `"DRAFT_QUERY"`; \} \| \{ `queryId`: `string`; `type`: `"SEND_QUERY"`; \} \| \{ `queryId`: `string`; `type`: `"CANCEL_QUERY"`; \} \| \{ `queryId`: `string`; `type`: `"CLOSE_QUERY"`; \} \| \{ `issueId`: `string`; `type`: `"ACCEPT_CORRECTION"`; \} \| \{ `issueId`: `string`; `type`: `"ACCEPT_UNCERTAINTY"`; \} \| \{ `issueId`: `string`; `type`: `"REJECT_RESPONSE"`; \} \| \{ `payload`: `Record`\<`string`, `unknown`\>; `reason`: `string`; `submissionId`: `string`; `type`: `"SITE_SOURCE_CORRECTION"`; \} \| \{ `submissionIds?`: `string`[]; `type`: `"REPLAY_SUBMISSIONS"`; \} \| \{ `type`: `"REPLAY_DERIVATIONS"`; \} \| \{ `type`: `"REQUEST_LOCK"`; \} \| \{ `type`: `"RETURN_TO_WORKBENCH"`; \} \| \{ `type`: `"CONFIRM_LOCK"`; \} \| \{ `savedAt?`: `string`; `type`: `"EXPORT_SAVE"`; \} \| \{ `type`: `"EXPORT_DATASETS"`; \}

Main thread to worker commands.

## Union Members

### Type Literal

\{ `rejectedCommands?`: `number`; `scenario?`: [`ScenarioId`](ScenarioId.md); `seed`: `number`; `type`: `"INIT"`; \}

#### rejectedCommands?

> `optional` **rejectedCommands?**: `number`

Rejections carried over from a restored save (#2054).

#### scenario?

> `optional` **scenario?**: [`ScenarioId`](ScenarioId.md)

#### seed

> **seed**: `number`

#### type

> **type**: `"INIT"`

***

### Type Literal

\{ `type`: `"ACCEPT_BRIEF"`; \}

***

### Type Literal

\{ `speed`: [`SimSpeed`](SimSpeed.md); `type`: `"SET_SPEED"`; \}

***

### Type Literal

\{ `isPaused`: `boolean`; `type`: `"SET_PAUSED"`; \}

***

### Type Literal

\{ `type`: `"STEP_TICK"`; \}

***

### Type Literal

\{ `realMs`: `number`; `type`: `"TICK"`; \}

***

### Type Literal

\{ `minute`: `number`; `type`: `"ADVANCE_TO"`; \}

***

### Type Literal

\{ `edges`: [`CanvasEdge`](../interfaces/CanvasEdge.md)[]; `nodes`: [`CanvasNode`](../interfaces/CanvasNode.md)[]; `type`: `"LOAD_GRAPH"`; \}

***

### Type Literal

\{ `edges`: [`CanvasEdge`](../interfaces/CanvasEdge.md)[]; `nodes`: [`CanvasNode`](../interfaces/CanvasNode.md)[]; `type`: `"VALIDATE_GRAPH"`; \}

***

### Type Literal

\{ `edges`: [`CanvasEdge`](../interfaces/CanvasEdge.md)[]; `nodes`: [`CanvasNode`](../interfaces/CanvasNode.md)[]; `revisionId`: `string`; `type`: `"PUBLISH_REVISION"`; \}

***

### Type Literal

\{ `evidenceLinked`: `boolean`; `issueId`: `string`; `message?`: `string`; `type`: `"DRAFT_QUERY"`; \}

***

### Type Literal

\{ `queryId`: `string`; `type`: `"SEND_QUERY"`; \}

***

### Type Literal

\{ `queryId`: `string`; `type`: `"CANCEL_QUERY"`; \}

***

### Type Literal

\{ `queryId`: `string`; `type`: `"CLOSE_QUERY"`; \}

***

### Type Literal

\{ `issueId`: `string`; `type`: `"ACCEPT_CORRECTION"`; \}

***

### Type Literal

\{ `issueId`: `string`; `type`: `"ACCEPT_UNCERTAINTY"`; \}

***

### Type Literal

\{ `issueId`: `string`; `type`: `"REJECT_RESPONSE"`; \}

***

### Type Literal

\{ `payload`: `Record`\<`string`, `unknown`\>; `reason`: `string`; `submissionId`: `string`; `type`: `"SITE_SOURCE_CORRECTION"`; \}

***

### Type Literal

\{ `submissionIds?`: `string`[]; `type`: `"REPLAY_SUBMISSIONS"`; \}

***

### Type Literal

\{ `type`: `"REPLAY_DERIVATIONS"`; \}

***

### Type Literal

\{ `type`: `"REQUEST_LOCK"`; \}

***

### Type Literal

\{ `type`: `"RETURN_TO_WORKBENCH"`; \}

***

### Type Literal

\{ `type`: `"CONFIRM_LOCK"`; \}

***

### Type Literal

\{ `savedAt?`: `string`; `type`: `"EXPORT_SAVE"`; \}

***

### Type Literal

\{ `type`: `"EXPORT_DATASETS"`; \}
