[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/bom](../README.md) / StandardFeed

# Type Alias: StandardFeed

> **StandardFeed** = \{ `kind`: `"cdisc-site"`; `labels`: readonly `string`[]; `page`: `string`; \} \| \{ `kind`: `"git-tags"`; `repository`: `string`; \}

Where the newest published version of a standard is read from.

`cdisc-site`: the standard's public page on cdisc.org, whose version table
lists each release as text such as `SDTMIG v3.4`. `labels` are the exact
text before the version (`SDTMIG`); the highest version under any of them
is the newest.

`git-tags`: a CDISC repository on GitHub whose release tags are `vX.Y.Z`.
