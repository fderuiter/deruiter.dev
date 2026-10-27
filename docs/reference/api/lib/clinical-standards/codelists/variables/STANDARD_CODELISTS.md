[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/codelists](../README.md) / STANDARD\_CODELISTS

# Variable: STANDARD\_CODELISTS

> `const` **STANDARD\_CODELISTS**: [`CodelistDefinition`](../interfaces/CodelistDefinition.md)[]

Standard codelists offered by CRF Studio.

A codelist that CDISC publishes carries its NCI codelist code, and each
term carries the CDISC submission value and NCI code from
[CDISC\_CT\_PACKAGE\_VERSION](CDISC_CT_PACKAGE_VERSION.md). A codelist that CDISC does not publish
(AEREL, MHCAT, the device tracking lists) is sponsor-defined: it has no
NCI codelist code and its terms have no NCI codes, because a code borrowed
from another concept would be published in every ODM, Define-XML and SAS
export.
