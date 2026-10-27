[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/odm-xml-serializer](../README.md) / CRF\_STUDIO\_ODM\_NAMESPACE

# Variable: CRF\_STUDIO\_ODM\_NAMESPACE

> `const` **CRF\_STUDIO\_ODM\_NAMESPACE**: `"https://deruiter.dev/ns/crf-studio/v1"` = `"https://deruiter.dev/ns/crf-studio/v1"`

Namespace of CRF Studio's ODM vendor extension. ODM 1.3.2 has no place for
a design-change audit trail, so it is written under this namespace in the
`MetaDataVersionElementExtension` slot, the way Define-XML extends ODM.
Without an audit trail the file is plain ODM 1.3.2.
