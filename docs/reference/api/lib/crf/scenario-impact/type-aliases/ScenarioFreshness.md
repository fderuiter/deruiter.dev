[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/scenario-impact](../README.md) / ScenarioFreshness

# Type Alias: ScenarioFreshness

> **ScenarioFreshness** = `"never_run"` \| `"current"` \| `"stale"` \| `"unknown"`

Freshness of a scenario's evidence against the current study.

Only `current` evidence may be presented as verification. `unknown` is
evidence recorded before per-dependency tracking whose form is unchanged:
honest about not knowing, and never shown as a pass.
