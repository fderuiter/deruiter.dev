[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/table](../README.md) / CsrLockView

# Interface: CsrLockView

CSR Lock as the table shows it (#922): the five sequence slots filled by
the selection in order, and the locked package's audit summary once won.

## Properties

### amendments

> **amendments**: `number`

Protocol amendments filed this Blind.

***

### amendRefusal

> **amendRefusal**: `string` \| `null`

Why a protocol amendment cannot be filed now, or null.

***

### lock

> **lock**: `Omit`\<[`PackageLock`](PackageLock.md), `"before"`\> \| `null`

The audit summary once the package is locked, else null.

***

### packageName

> **packageName**: `string`

***

### report

> **report**: [`PackageReport`](../../package/interfaces/PackageReport.md)

The selection reconciled slot by slot.
