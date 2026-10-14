[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/scenarios](../README.md) / generateClinicalSubject

# Function: generateClinicalSubject()

> **generateClinicalSubject**(`errorProbability?`, `forceSAE?`, `customSeq?`, `activeDomains?`, `random?`): [`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md)

Generates a ClinicalSubject with 2-3 observations. Flagged observations on
a field with a procedural generator are usually generated from parameters
(#2088), so values and options differ from run to run; the rest come from
the authored templates.

## Parameters

### errorProbability?

`number` = `0.5`

### forceSAE?

`boolean` = `false`

### customSeq?

`number`

### activeDomains?

[`CDISCDomain`](../../types/type-aliases/CDISCDomain.md)[] = `...`

### random?

() => `number`

Random source returning values in [0, 1); pass a seeded
  one to make the subject repeatable.

## Returns

[`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md)
