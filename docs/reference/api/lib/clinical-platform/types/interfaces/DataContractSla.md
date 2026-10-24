[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / DataContractSla

# Interface: DataContractSla

Service levels a data product promises.

## Properties

### availability

> `readonly` **availability**: `number`

Share of time the product is available to read, from 0 to 1. A static
build has no uptime to measure, so the contract check confirms only that
the product was published.

***

### completeness

> `readonly` **completeness**: `number`

Minimum share of required values present, from 0 to 1.

***

### freshnessHours

> `readonly` **freshnessHours**: `number`

Oldest the latest load may be when the product is read, in hours.
