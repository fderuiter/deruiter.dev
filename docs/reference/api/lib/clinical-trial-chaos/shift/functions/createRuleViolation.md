[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / createRuleViolation

# Function: createRuleViolation()

> **createRuleViolation**(`observation`, `choice`, `result`, `subjectLabel`, `now?`, `random?`): [`RecordedRuleViolation`](../../types/interfaces/RecordedRuleViolation.md)

Records a wrong fix for the end-of-run inspection report.

## Parameters

### observation

[`ClinicalObservation`](../../types/interfaces/ClinicalObservation.md)

The observation the player tried to fix.

### choice

`string`

The rejected answer.

### result

The failed validation's explanation and rule name.

#### explanation

`string`

#### ruleName?

`string`

### subjectLabel

`string`

Label of the subject the observation belongs to.

### now?

`number` = `...`

Epoch milliseconds for the id and timestamp.

### random?

() => `number`

Random source for the id suffix.

## Returns

[`RecordedRuleViolation`](../../types/interfaces/RecordedRuleViolation.md)

The violation record.
