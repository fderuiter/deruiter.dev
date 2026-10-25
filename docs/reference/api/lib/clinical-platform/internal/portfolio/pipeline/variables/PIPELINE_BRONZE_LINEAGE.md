[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/portfolio/pipeline](../README.md) / PIPELINE\_BRONZE\_LINEAGE

# Variable: PIPELINE\_BRONZE\_LINEAGE

> `const` **PIPELINE\_BRONZE\_LINEAGE**: readonly `object`[]

The bronze columns each collected variable feeds, as `readSubjects` and
`studyFromPipeline` read them, for studies whose subjects come from the
pipeline. Kept beside the code it describes so the two change together;
the lineage tests check every reference resolves.
