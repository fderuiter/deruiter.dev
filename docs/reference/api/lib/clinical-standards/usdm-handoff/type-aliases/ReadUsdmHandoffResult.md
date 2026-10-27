[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/usdm-handoff](../README.md) / ReadUsdmHandoffResult

# Type Alias: ReadUsdmHandoffResult

> **ReadUsdmHandoffResult** = \{ `envelope`: [`UsdmHandoffEnvelope`](../interfaces/UsdmHandoffEnvelope.md); `status`: `"ok"`; \} \| \{ `problem`: [`UsdmHandoffProblem`](UsdmHandoffProblem.md); `status`: `"invalid"`; \}

The result of reading an envelope.
