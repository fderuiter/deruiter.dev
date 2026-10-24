# Dataset-JSON 1.1 JSON schema (vendored test fixture)

`dataset.schema.json` is the CDISC Dataset-JSON 1.1 JSON schema, copied
byte for byte from the CDISC repository. The study data package tests
(`__tests__/study-data-export.test.ts`) validate every Dataset-JSON file the
pipeline writes against it with Ajv. It is test-only and never ships to
visitors.

| Field             | Value                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| Repository        | <https://github.com/cdisc-org/DataExchange-DatasetJson>                                        |
| Tag               | `v1.1` (tag object `f735969cdf3b6af87a0fcbd064c49e9274f69c5e`)                                 |
| Commit            | `6586cf933013a72545f70010be0a36264e026937`                                                     |
| File              | `schema/dataset.schema.json`                                                                   |
| URL               | <https://raw.githubusercontent.com/cdisc-org/DataExchange-DatasetJson/v1.1/schema/dataset.schema.json> |
| Fetched           | 2026-10-23                                                                                     |
| SHA-256           | `dd7190ff3782edf31f7de42a3d68c2328e6194e62f9dfbdc2e776edfea2eb09c`                             |
| Licence           | MIT, Copyright (c) 2022 cdisc. Full text in `LICENSE`, from the same tag.                      |
| `LICENSE` SHA-256 | `5098baf900774d3f6ec6e20f0916a8e2e72f7cf987fb7e72337b783c65f1d4f6`                             |

The upstream file uses CRLF line endings. The folder is listed in
`.prettierignore` and the schema is marked `-text` in `.gitattributes`, so
neither formatting nor line-ending normalisation changes the vendored bytes;
a test checks the SHA-256 above. To update, fetch the file
from a new tag, replace both files, and update this table and the hash in
the test.
