[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/define/write-define-xml](../README.md) / writeDefineXml

# Function: writeDefineXml()

> **writeDefineXml**(`define`): `string`

Serialises a Define-XML 2.1 document model as XML text.

The root carries `def:Context="Other"`, since the document describes
synthetic demonstration data rather than a regulatory submission, and
`def:DefineVersion` matches the 2.1.0 schema the tests check it against.
The synthetic-data notice is in an XML comment, the ODM `Description`, the
study description and a CommentDef on the metadata version.

## Parameters

### define

[`DefineDocument`](../../model/interfaces/DefineDocument.md)

The model from `buildDefine`.

## Returns

`string`

The XML text, UTF-8 ready, with a trailing newline.
