[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/usdm/handoff](../README.md) / HandoffReport

# Interface: HandoffReport

The supported-domains report shown before a handed-off run.

## Properties

### activities

> `readonly` **activities**: readonly [`HandoffActivity`](HandoffActivity.md)[]

***

### assumptions

> `readonly` **assumptions**: readonly [`HandoffAssumption`](../type-aliases/HandoffAssumption.md)[]

***

### notTabulatedDomains

> `readonly` **notTabulatedDomains**: readonly `string`[]

Domains named by an activity that the run does not tabulate.

***

### studyId

> `readonly` **studyId**: `string`

***

### tabulatedDomains

> `readonly` **tabulatedDomains**: readonly `string`[]

Domains with at least one tabulated activity, in generator order.

***

### title

> `readonly` **title**: `string`

***

### unplannedEncounters

> `readonly` **unplannedEncounters**: readonly `object`[]

Encounters with no timing that reaches the study anchor (unscheduled
visits). The run leaves them out; the generator adds its own unscheduled
visits.
