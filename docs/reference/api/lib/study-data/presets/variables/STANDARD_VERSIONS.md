[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/presets](../README.md) / STANDARD\_VERSIONS

# Variable: STANDARD\_VERSIONS

> `const` **STANDARD\_VERSIONS**: [`StandardVersions`](../../types/type-aliases/StandardVersions.md)

The standard versions every run applies and declares in TS, Define-XML and
the run manifest. The CT entry is the date of the NCI EVS CDISC
Controlled Terminology package that the local codelist subset is aligned
to. The subset is hand-curated; every NCI code, codelist and term in it
is checked against that release by `__tests__/cdisc-ct-release.test.ts`. It
covers only what the pipeline uses, so it is not a claim of conformance to
the whole package. Every value comes from [CLINICAL\_STANDARDS\_PROFILE](../../standards/variables/CLINICAL_STANDARDS_PROFILE.md).
