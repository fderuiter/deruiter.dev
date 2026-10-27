[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/form-test-harness](../README.md) / FormTestReport

# Interface: FormTestReport

Everything the dock shows for one run, derived in a single pass so the
panels cannot disagree with each other.

## Properties

### calculations

> **calculations**: [`CalculationOutcome`](CalculationOutcome.md)[]

***

### conditional

> **conditional**: [`FormConditionalState`](../../conditional-logic/interfaces/FormConditionalState.md)

***

### formId

> **formId**: `string`

***

### rules

> **rules**: [`RuleOutcome`](RuleOutcome.md)[]

***

### scope

> **scope**: [`FormTestScope`](FormTestScope.md)

***

### summary

> **summary**: `object`

Counts for the dock's status strip.

#### fieldsHidden

> **fieldsHidden**: `number`

#### fieldsVisible

> **fieldsVisible**: `number`

#### openQueries

> **openQueries**: `number`

#### rulesFired

> **rulesFired**: `number`

#### rulesUndecidable

> **rulesUndecidable**: `number`

#### unsatisfiedRequired

> **unsatisfiedRequired**: `number`

***

### unsatisfiedRequired

> **unsatisfiedRequired**: [`FieldConditionalState`](../../conditional-logic/interfaces/FieldConditionalState.md)[]

Visible, required and still empty.
