[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/protocol-drift/types](../README.md) / PDCommand

# Type Alias: PDCommand

> **PDCommand** = \{ `scenario?`: [`ScenarioId`](ScenarioId.md); `seed`: `number`; `type`: `"INIT"`; \} \| \{ `type`: `"ACCEPT_BRIEF"`; \} \| \{ `speed`: [`SimSpeed`](SimSpeed.md); `type`: `"SET_SPEED"`; \} \| \{ `isPaused`: `boolean`; `type`: `"SET_PAUSED"`; \} \| \{ `type`: `"STEP_TICK"`; \} \| \{ `realMs`: `number`; `type`: `"TICK"`; \} \| \{ `minute`: `number`; `type`: `"ADVANCE_TO"`; \} \| \{ `edges`: [`CanvasEdge`](../interfaces/CanvasEdge.md)[]; `nodes`: [`CanvasNode`](../interfaces/CanvasNode.md)[]; `type`: `"LOAD_GRAPH"`; \} \| \{ `edges`: [`CanvasEdge`](../interfaces/CanvasEdge.md)[]; `nodes`: [`CanvasNode`](../interfaces/CanvasNode.md)[]; `type`: `"VALIDATE_GRAPH"`; \} \| \{ `edges`: [`CanvasEdge`](../interfaces/CanvasEdge.md)[]; `nodes`: [`CanvasNode`](../interfaces/CanvasNode.md)[]; `revisionId`: `string`; `type`: `"PUBLISH_REVISION"`; \} \| \{ `evidenceLinked`: `boolean`; `issueId`: `string`; `message?`: `string`; `type`: `"DRAFT_QUERY"`; \} \| \{ `queryId`: `string`; `type`: `"SEND_QUERY"`; \} \| \{ `queryId`: `string`; `type`: `"CANCEL_QUERY"`; \} \| \{ `queryId`: `string`; `type`: `"CLOSE_QUERY"`; \} \| \{ `issueId`: `string`; `type`: `"ACCEPT_CORRECTION"`; \} \| \{ `issueId`: `string`; `type`: `"ACCEPT_UNCERTAINTY"`; \} \| \{ `issueId`: `string`; `type`: `"REJECT_RESPONSE"`; \} \| \{ `payload`: `Record`\<`string`, `unknown`\>; `reason`: `string`; `submissionId`: `string`; `type`: `"SITE_SOURCE_CORRECTION"`; \} \| \{ `submissionIds?`: `string`[]; `type`: `"REPLAY_SUBMISSIONS"`; \} \| \{ `type`: `"REPLAY_DERIVATIONS"`; \} \| \{ `type`: `"REQUEST_LOCK"`; \} \| \{ `type`: `"RETURN_TO_WORKBENCH"`; \} \| \{ `type`: `"CONFIRM_LOCK"`; \} \| \{ `savedAt?`: `string`; `type`: `"EXPORT_SAVE"`; \} \| \{ `type`: `"EXPORT_DATASETS"`; \}

Main thread to worker commands.
