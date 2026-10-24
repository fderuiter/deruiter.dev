# ODCS v3.2.0 JSON schema (vendored test fixture)

`odcs-json-schema-v3.2.0.json` is the Open Data Contract Standard (ODCS)
v3.2.0 JSON schema, copied byte for byte from the Bitol repository. At the
`v3.2.0` tag the repository publishes it as `odcs-json-schema-latest.json`;
it is renamed here so the version is in the file name. The data contract
tests (`__tests__/clinical-platform-contracts.test.ts`) validate every ODCS
document the platform generates against it with Ajv. It is test-only and
never ships to visitors.

| Field             | Value                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| Repository        | <https://github.com/bitol-io/open-data-contract-standard>                                                           |
| Tag               | `v3.2.0` (a lightweight tag on the commit below)                                                                    |
| Commit            | `f0bdad95346905d500be5ef4b2c2d9b1d95223b7`                                                                          |
| File              | `schema/odcs-json-schema-latest.json`                                                                               |
| URL               | <https://raw.githubusercontent.com/bitol-io/open-data-contract-standard/v3.2.0/schema/odcs-json-schema-latest.json> |
| Fetched           | 2026-10-24                                                                                                          |
| SHA-256           | `edb41f33ec46e84780e99872ab2bd67f074959d2bf3e9c9fc54e61f8982b0d93`                                                  |
| Licence           | Apache License 2.0, The Bitol Contributors. Full text in `LICENSE`, from the same commit.                           |
| `LICENSE` SHA-256 | `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4`                                                  |

The folder is listed in `.prettierignore` and marked `-text` in
`.gitattributes`, so neither formatting nor line-ending normalisation
changes the vendored bytes; a test checks the SHA-256 above. To update,
fetch the schema from a new tag, replace both files, and update this table
and the hash in the test.
