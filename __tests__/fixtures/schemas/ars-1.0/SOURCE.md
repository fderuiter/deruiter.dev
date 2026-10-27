# ARS 1.0 JSON schema (vendored test fixture)

`ars_ldm.schema.json` is the JSON schema of the CDISC Analysis Results
Standard (ARS) 1.0 logical data model, copied byte for byte from the CDISC
repository. The reporting tests (`__tests__/study-data-ars-schema.test.ts`)
validate every ARS reporting event the pipeline writes against its
`ReportingEvent` class with Ajv. It is test-only and never ships to visitors.

| Field             | Value                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Repository        | <https://github.com/cdisc-org/analysis-results-standard>                                                                |
| Tag               | `v1.0.0` (lightweight tag)                                                                                              |
| Commit            | `18243bbf92a2ab62801f0813127452e25dd6b432`                                                                              |
| File              | `project/jsonschema/ars_ldm.schema.json`                                                                                |
| URL               | <https://raw.githubusercontent.com/cdisc-org/analysis-results-standard/v1.0.0/project/jsonschema/ars_ldm.schema.json>   |
| Fetched           | 2026-10-26                                                                                                              |
| SHA-256           | `bf8dd98f3cf0abc4e88624600e3cf1962db0fd76f461a1d7e5c841bd788102e4`                                                      |
| Licence           | MIT. Full text in `LICENSE`, from the same tag; upstream left its copyright line as the template placeholder.           |
| `LICENSE` SHA-256 | `4c21061e36524297b6173f929b507edea5208254af1d743370047e54f52f9ce1`                                                      |

The schema's root object allows additional properties, so the tests compile
`#/$defs/ReportingEvent`, whose classes do not. The folder is listed in
`.prettierignore` and both files are marked `-text` in `.gitattributes`, so
neither formatting nor line-ending normalisation changes the vendored bytes;
a test checks the SHA-256 above. To update, fetch the files from a new tag,
replace both, and update this table and the hash in the test.
