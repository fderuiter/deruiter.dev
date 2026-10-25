# OpenLineage 2-0-2 JSON schemas (vendored test fixture)

The OpenLineage run event schema (spec version 2-0-2) and the four facet
schemas the platform's lineage events use, copied byte for byte from the
OpenLineage repository at release `1.54.0`. The lineage tests
(`__tests__/clinical-platform-lineage.test.ts`) validate every event that
`toOpenLineageEvents` emits against them with Ajv. They are test-only and
never ship to visitors.

| File                             | Spec version | SHA-256                                                            |
| -------------------------------- | ------------ | ------------------------------------------------------------------ |
| `OpenLineage.json`               | 2-0-2        | `69f68bee00b9beac88a87059c0102410e7bb05f3f43c46d02a0409831eceb0d2` |
| `ColumnLineageDatasetFacet.json` | 1-2-0        | `04d96b4985ca32470c7f9d73163da76678fb160bc8d80cbbc5abf312e9537466` |
| `SchemaDatasetFacet.json`        | 1-2-0        | `50236a779aa64baa0bad0055391838bd22fcb36ce667c41d60ada80915e899b6` |
| `OwnershipDatasetFacet.json`     | 1-0-1        | `9a18a508746627eff18fa84ca1694e1a9f2d556ac0052dbdb6970d8a35f75231` |
| `JobTypeJobFacet.json`           | 2-0-4        | `11c12cab95a411ca31066c80d2bb4aefd37bbcadbda5e4d343d2069853b907d5` |
| `LICENSE`                        |              | `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4` |

| Field      | Value                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------- |
| Repository | <https://github.com/OpenLineage/OpenLineage>                                                  |
| Tag        | `1.54.0` (an annotated tag on the commit below)                                               |
| Commit     | `5688b2fd7f39bc9845ada52c5758327e4706edf5`                                                    |
| Files      | `spec/OpenLineage.json`, `spec/facets/<name>.json`, `LICENSE`                                 |
| URL        | <https://raw.githubusercontent.com/OpenLineage/OpenLineage/1.54.0/spec/OpenLineage.json>      |
| Fetched    | 2026-10-25                                                                                    |
| Licence    | Apache License 2.0, contributors to the OpenLineage project. Full text in `LICENSE`, same tag. |

The folder is under `__tests__/fixtures/schemas`, which `.prettierignore`
lists, and its files are marked `-text` in `.gitattributes`, so neither
formatting nor line-ending normalisation changes the vendored bytes; a test
checks every SHA-256 above. To update, fetch the files from a new release
tag, replace them, and update both tables and the hashes in the test.
