# Define-XML 2.1 schemas (vendored test fixture)

These are the Define-XML 2.1.0 XML schemas, the ODM 1.3.2 schemas they
extend and the W3C schemas those import, copied byte for byte from the CDISC
`library-xml` repository. The study data tests
(`__tests__/study-data-define.test.ts`) validate both Define-XML documents the
pipeline writes, SDTM and ADaM, against `cdisc-define-2.1/define2-1-0.xsd`
with `xmllint-wasm` (libxml2 compiled to WebAssembly). They are test-only and
never ship to visitors.

The folder layout is the repository's `schema/` folder, so the relative
`xs:include`, `xs:import` and `xs:redefine` paths inside the files resolve
unchanged.

| Field      | Value                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------- |
| Repository | <https://github.com/cdisc-org/library-xml>                                                  |
| Commit     | `f0ca31eae065802e624e2735f3cefa6e73e8a2ec`                                                  |
| Folders    | `schema/cdisc-define-2.1/` (the four `.xsd` files), `schema/cdisc-odm-1.3.2/`, `schema/core/` |
| URL base   | `https://raw.githubusercontent.com/cdisc-org/library-xml/f0ca31eae065802e624e2735f3cefa6e73e8a2ec/` |
| Fetched    | 2026-10-24                                                                                  |
| Licence    | MIT, Copyright (c) 2021 cdisc. Full text in `LICENSE`, from the same commit.                |

## Files

| File                                    | SHA-256                                                            |
| --------------------------------------- | ------------------------------------------------------------------ |
| `LICENSE`                               | `683f463922ef377a1090f17a47e0d5a6466321b64d33392cec2864ea9be2ffd2` |
| `cdisc-define-2.1/define2-1-0.xsd`      | `62618c24aa046ecc3f4cb332e95de1281b1d7cbff12702ff2012ed65f3171f18` |
| `cdisc-define-2.1/define-extension.xsd` | `26ea16dbb81c341635f122555e46dc7699d09083a3ec352fa0a50ebae7f3cdb2` |
| `cdisc-define-2.1/define-ns.xsd`        | `fd26bc307925600cb075e9400dd1fd3bb98578686274e6db600e19e4ac54e344` |
| `cdisc-define-2.1/define-enumerations.xsd` | `8cc033aa2153c37d6b98ea7b571724988d470acb9109902d19853bbcf6b35960` |
| `cdisc-odm-1.3.2/ODM1-3-2.xsd`          | `5f3b701df3e80db4ef27dea1dcfeb8d7dee613fb6946550ec2c1e31606b61cb7` |
| `cdisc-odm-1.3.2/ODM1-3-2-foundation.xsd` | `005df55770a816a69c9e9262019b2c909c6a952e57138ca661f7afda5a72b271` |
| `core/xml.xsd`                          | `258ac9c0f078fc9692735140f2d21541e8bf16941bed42833c1a5f965b52c6dc` |
| `core/xlink.xsd`                        | `e4b134b25c547bc74808bbcc0818febd2f4a58b759556443999365ec4d53d594` |
| `core/xmldsig-core-schema.xsd`          | `111a972ccb9916cb95df9af4b6c1775307292463639de69d6fe63516bb2d850e` |
| `core/LICENSE-W3C` (written here)       | `5ecc35275c910850ce41cee0fcd5d95d542d3aaf46918b623bf7788cad2d0625` |

The repository's `schema/cdisc-define-2.1/define-enumerations.html` is a
documentation page, not a schema, and is not copied.

## Which version this is

`define2-1-0.xsd` describes itself as the "Define-XML 2.1.0 schema as
developed by the CDISC XML Technologies Team". This is the 2021 copy of
Define-XML 2.1.0 that `library-xml` carries, not a later 2.1.x release from
cdisc.org. The pipeline writes `def:DefineVersion="2.1.0"` to match it, and
the test checks that the two agree.

## Licences

- The CDISC files (`cdisc-define-2.1/`, `cdisc-odm-1.3.2/`) are under the
  repository's MIT licence in `LICENSE`.
- The `core/` files are schemas for W3C namespaces: the XML namespace
  (`xml.xsd`), XML Signature (`xmldsig-core-schema.xsd`) and XLink
  (`xlink.xsd`, a reduced schema for the XLink attributes rather than the
  W3C's own file). They carry no notice of their own. `core/LICENSE-W3C`
  reproduces the W3C Software and Document License (2023 version) that
  W3C publishes them under.

No file here is changed. The folder is listed in `.prettierignore` and
marked `-text` in `.gitattributes`, so neither formatting nor line-ending
normalisation can change the vendored bytes, and a test checks every SHA-256
above. To update, fetch the same paths at a new commit, replace the files,
and update both tables and the hashes in the test.
