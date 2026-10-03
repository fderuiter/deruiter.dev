[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/types](../README.md) / SetupStageStatus

# Type Alias: SetupStageStatus

> **SetupStageStatus** = `"completed"` \| `"skipped"` \| `"failed"` \| `"manual"` \| `"cancelled"`

Outcome of a stage.

- `completed`: the stage did everything it set out to do.
- `skipped`: a flag or the user chose not to run it.
- `failed`: it ran and something went wrong.
- `manual`: it needs a person to finish it (a missing secret, a refused
  production target, a dashboard step).
- `cancelled`: the user pressed Ctrl-C while it ran.
