[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/core/layers](../README.md) / RuleState

# Type Alias: RuleState

> **RuleState** = `"pass"` \| `"fail"` \| `"not-applicable"` \| `"not-evaluated"` \| `"unsupported"` \| `"execution-error"`

How one rule or check came out. `pass`: it ran and found nothing.
`fail`: it ran and reported findings. `not-applicable`: it ran and the
data has nothing it applies to (CORE's SKIPPED). `not-evaluated`: it
exists but this site does not run it. `unsupported`: no rules exist for
this target in the engine named. `execution-error`: the engine could not
finish the rule.
