[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/portfolio/records](../README.md) / screenFailureReasons

# Function: screenFailureReasons()

> **screenFailureReasons**(`seed`, `studyId`): () => `string`

Draws screen failure reasons for one study, in subject order, from a
stream of their own: adding the reasons moved no other generated value.

## Parameters

### seed

`number`

Portfolio seed.

### studyId

`string`

The study's id.

## Returns

A function giving the next screen failure's reason.

() => `string`
