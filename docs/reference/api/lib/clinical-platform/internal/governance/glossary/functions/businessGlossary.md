[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/governance/glossary](../README.md) / businessGlossary

# Function: businessGlossary()

> **businessGlossary**(`options?`): [`BusinessGlossaryEntry`](../../../../types/interfaces/BusinessGlossaryEntry.md)[]

The business glossary: every term a metric links, and the terms in
`BUSINESS_GLOSSARY_EXTRA_TERMS`, each with the metrics that link it.

## Parameters

### options?

[`BusinessGlossaryOptions`](../interfaces/BusinessGlossaryOptions.md) = `{}`

The metrics and the glossary to read.

## Returns

[`BusinessGlossaryEntry`](../../../../types/interfaces/BusinessGlossaryEntry.md)[]

The entries, by term name ignoring case.

## Throws

Error when a metric or the extra list names a term the glossary
  does not hold.
