[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ScenarioExpectation

# Interface: ScenarioExpectation

What a scenario expects of the pipeline, declared as data.

## Properties

### derivation

> `readonly` **derivation**: `string`

The derivation behaviour the scenario checks, in words.

***

### findings

> `readonly` **findings**: readonly `string`[]

Rule ids that must report at least one finding on the target subject.
No other rule may report a finding on that subject that it did not
report before the scenario was applied.
