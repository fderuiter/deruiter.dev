[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/usdm-handoff](../README.md) / UsdmHandoffEnvelope

# Interface: UsdmHandoffEnvelope

A USDM document on its way from one clinical tool to another.

## Properties

### envelopeVersion

> `readonly` **envelopeVersion**: `1`

***

### sha256

> `readonly` **sha256**: `string`

Lowercase hex SHA-256 of `canonicalUsdmJson(usdm)`.

***

### source

> `readonly` **source**: [`ClinicalTool`](../type-aliases/ClinicalTool.md)

***

### study

> `readonly` **study**: [`UsdmHandoffStudy`](UsdmHandoffStudy.md)

***

### target

> `readonly` **target**: [`ClinicalTool`](../type-aliases/ClinicalTool.md)

***

### usdm

> `readonly` **usdm**: `unknown`
