[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/forecast](../README.md) / EnrollmentSimulationInput

# Interface: EnrollmentSimulationInput

A recruitment process to simulate: the input of `simulateEnrollmentCompletion` (#2632).

## Properties

### laterSites

> `readonly` **laterSites**: readonly ([`RecruitmentRate`](RecruitmentRate.md) & `object`)[]

Rates of sites that start recruiting later, with their first day.

***

### remaining

> `readonly` **remaining**: `number`

Subjects still to enroll, 1 or more.

***

### runs

> `readonly` **runs**: `number`

Number of simulated runs, from 100 to 20,000.

***

### sites

> `readonly` **sites**: readonly [`RecruitmentRate`](RecruitmentRate.md)[]

Rates of the sites recruiting from day 0.

***

### streamKey

> `readonly` **streamKey**: `string`

Key of the random stream; the same key gives the same runs.
