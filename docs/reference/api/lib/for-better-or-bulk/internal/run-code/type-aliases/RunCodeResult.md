[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/run-code](../README.md) / RunCodeResult

# Type Alias: RunCodeResult

> **RunCodeResult** = \{ `ok`: `true`; `run`: [`SharedRun`](../interfaces/SharedRun.md); \} \| \{ `message`: `string`; `ok`: `false`; `reason`: [`RunCodeError`](RunCodeError.md); \}

The outcome of decoding: the run, or a refusal with its reason.
