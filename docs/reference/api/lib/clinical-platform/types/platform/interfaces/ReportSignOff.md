[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / ReportSignOff

# Interface: ReportSignOff

An owner's sign-off on one version of a certified report.

## Properties

### date

> `readonly` **date**: `string`

ISO 8601 date of the sign-off.

***

### role

> `readonly` **role**: `string`

Role that signed off (a role, not a person).

***

### version

> `readonly` **version**: `string`

Report version signed off; must equal the report's version.
