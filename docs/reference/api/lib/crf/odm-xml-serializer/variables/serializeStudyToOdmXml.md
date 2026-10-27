[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/odm-xml-serializer](../README.md) / serializeStudyToOdmXml

# Variable: serializeStudyToOdmXml

> `const` **serializeStudyToOdmXml**: (`study`) => `string` = `exportStudyToCdiscOdmXml`

Serializes a StudyProtocol into CDISC ODM-XML v1.3.2. The output validates
against the ODM 1.3.2 schema; with an audit trail, against that schema
extended by the CRF Studio namespace.

## Parameters

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

## Returns

`string`
