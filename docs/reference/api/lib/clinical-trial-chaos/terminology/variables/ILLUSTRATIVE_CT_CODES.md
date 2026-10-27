[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/terminology](../README.md) / ILLUSTRATIVE\_CT\_CODES

# Variable: ILLUSTRATIVE\_CT\_CODES

> `const` **ILLUSTRATIVE\_CT\_CODES**: `Readonly`\<`Record`\<`string`, `string`\>\>

NCI codes the game cites that are outside the site's local CDISC
Controlled Terminology subset.

Every `ctCode` in Clinical Trial Chaos either resolves in that subset (CRF
Studio's standard codelists or the Study Data Pipeline's terminology) or is
listed here. These codes label the game's corrections. Like every NCI code
in the repository, each one is checked to exist in the pinned NCI EVS
release by `__tests__/cdisc-ct-release.test.ts`. A contract test holds the
two lists together.
