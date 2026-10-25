/**
 * Define-XML 2.1 serialiser. Writes the document model as ODM 1.3.2 with the
 * Define-XML 2.1 extensions, in the element order the schema requires, with
 * two-space indentation, LF line endings and a trailing newline. The same
 * model always gives the same bytes.
 */
import { CLINICAL_STANDARDS_PROFILE } from "../../standards";
import type {
  DefineCodeList,
  DefineDocument,
  DefineItem,
  DefineItemGroup,
  DefineItemRef,
  DefineStandard,
} from "./model";

const ODM_NS = "http://www.cdisc.org/ns/odm/v1.3";
const DEF_NS = "http://www.cdisc.org/ns/def/v2.1";
const XLINK_NS = "http://www.w3.org/1999/xlink";

type Attributes = readonly (readonly [string, string | number | undefined])[];

/** Escapes text for an XML attribute value or element content. */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\r/g, "&#13;")
    .replace(/\n/g, "&#10;")
    .replace(/\t/g, "&#9;");
}

class XmlWriter {
  private readonly lines: string[] = [];
  private depth = 0;

  private attributes(attributes: Attributes): string {
    return attributes
      .filter(([, value]) => value !== undefined)
      .map(([name, value]) => ` ${name}="${escapeXml(String(value))}"`)
      .join("");
  }

  private indent(): string {
    return "  ".repeat(this.depth);
  }

  raw(line: string): void {
    this.lines.push(line);
  }

  empty(name: string, attributes: Attributes = []): void {
    this.lines.push(`${this.indent()}<${name}${this.attributes(attributes)}/>`);
  }

  text(name: string, text: string, attributes: Attributes = []): void {
    this.lines.push(
      `${this.indent()}<${name}${this.attributes(attributes)}>${escapeXml(text)}</${name}>`
    );
  }

  element(name: string, attributes: Attributes, body: () => void): void {
    this.lines.push(`${this.indent()}<${name}${this.attributes(attributes)}>`);
    this.depth += 1;
    body();
    this.depth -= 1;
    this.lines.push(`${this.indent()}</${name}>`);
  }

  toString(): string {
    return `${this.lines.join("\n")}\n`;
  }
}

function description(xml: XmlWriter, name: string, text: string): void {
  xml.element(name, [], () =>
    xml.text("TranslatedText", text, [["xml:lang", "en"]])
  );
}

const yesNo = (value: boolean) => (value ? "Yes" : "No");

function writeStandard(xml: XmlWriter, standard: DefineStandard): void {
  xml.empty("def:Standard", [
    ["OID", standard.oid],
    ["Name", standard.name],
    ["Type", standard.type],
    ["PublishingSet", standard.publishingSet],
    ["Version", standard.version],
    ["Status", standard.status],
    ["def:CommentOID", standard.commentOid],
  ]);
}

function writeItemRef(xml: XmlWriter, ref: DefineItemRef): void {
  const attributes: Attributes = [
    ["ItemOID", ref.itemOid],
    ["OrderNumber", ref.orderNumber],
    ["Mandatory", yesNo(ref.mandatory)],
    ["KeySequence", ref.keySequence],
    ["MethodOID", ref.methodOid],
    ["Role", ref.role],
  ];
  if (!ref.whereClauseOid) {
    xml.empty("ItemRef", attributes);
    return;
  }
  xml.element("ItemRef", attributes, () =>
    xml.empty("def:WhereClauseRef", [["WhereClauseOID", ref.whereClauseOid]])
  );
}

function writeItemGroup(xml: XmlWriter, group: DefineItemGroup): void {
  xml.element(
    "ItemGroupDef",
    [
      ["OID", group.oid],
      ["Name", group.name],
      ["SASDatasetName", group.name],
      ["Repeating", yesNo(group.repeating)],
      ["IsReferenceData", yesNo(group.isReferenceData)],
      ["Purpose", group.purpose],
      ["Domain", group.domain],
      ["def:Structure", group.structure],
      ["def:StandardOID", group.standardOid],
      ["def:HasNoData", group.records === 0 ? "Yes" : undefined],
      ["def:ArchiveLocationID", group.leaf.id],
    ],
    () => {
      description(xml, "Description", group.label);
      for (const ref of group.itemRefs) writeItemRef(xml, ref);
      if (group.subClassName) {
        xml.element("def:Class", [["Name", group.className]], () =>
          xml.empty("def:SubClass", [["Name", group.subClassName]])
        );
      } else {
        xml.empty("def:Class", [["Name", group.className]]);
      }
      xml.element(
        "def:leaf",
        [
          ["ID", group.leaf.id],
          ["xlink:href", group.leaf.href],
        ],
        () => xml.text("def:title", group.leaf.title)
      );
    }
  );
}

function writeItem(xml: XmlWriter, item: DefineItem): void {
  xml.element(
    "ItemDef",
    [
      ["OID", item.oid],
      ["Name", item.name],
      ["SASFieldName", item.name],
      ["DataType", item.dataType],
      ["Length", item.length],
      ["SignificantDigits", item.significantDigits],
      ["def:DisplayFormat", item.displayFormat],
    ],
    () => {
      description(xml, "Description", item.label);
      if (item.codeListOid) {
        xml.empty("CodeListRef", [["CodeListOID", item.codeListOid]]);
      }
      const { origin } = item;
      const originAttributes: Attributes = [
        ["Type", origin.type],
        ["Source", origin.source],
      ];
      if (origin.description) {
        xml.element("def:Origin", originAttributes, () =>
          description(xml, "Description", origin.description!)
        );
      } else {
        xml.empty("def:Origin", originAttributes);
      }
      if (item.valueListOid) {
        xml.empty("def:ValueListRef", [["ValueListOID", item.valueListOid]]);
      }
    }
  );
}

function writeCodeList(xml: XmlWriter, list: DefineCodeList): void {
  xml.element(
    "CodeList",
    [
      ["OID", list.oid],
      ["Name", list.name],
      ["DataType", list.dataType],
      ["def:StandardOID", list.standardOid],
    ],
    () => {
      for (const term of list.terms) {
        const attributes: Attributes = [
          ["CodedValue", term.codedValue],
          ["OrderNumber", term.orderNumber],
          ["def:ExtendedValue", term.extended ? "Yes" : undefined],
        ];
        const alias = () => {
          if (term.nciCode) {
            xml.empty("Alias", [
              ["Context", "nci:ExtCodeID"],
              ["Name", term.nciCode],
            ]);
          }
        };
        if (list.decoded) {
          xml.element("CodeListItem", attributes, () => {
            description(xml, "Decode", term.decode ?? term.codedValue);
            alias();
          });
        } else if (term.nciCode) {
          xml.element("EnumeratedItem", attributes, alias);
        } else {
          xml.empty("EnumeratedItem", attributes);
        }
      }
      if (list.nciCode) {
        xml.empty("Alias", [
          ["Context", "nci:ExtCodeID"],
          ["Name", list.nciCode],
        ]);
      }
    }
  );
}

/**
 * Serialises a Define-XML 2.1 document model as XML text.
 *
 * The root carries `def:Context="Other"`, since the document describes
 * synthetic demonstration data rather than a regulatory submission, and
 * `def:DefineVersion` matches the 2.1.0 schema the tests check it against.
 * The synthetic-data notice is in an XML comment, the ODM `Description`, the
 * study description and a CommentDef on the metadata version.
 *
 * @param define - The model from `buildDefine`.
 * @returns The XML text, UTF-8 ready, with a trailing newline.
 */
export function writeDefineXml(define: DefineDocument): string {
  const xml = new XmlWriter();
  xml.raw('<?xml version="1.0" encoding="UTF-8"?>');
  xml.raw(`<!-- ${define.notice.replace(/--/g, "- -")} -->`);
  xml.element(
    "ODM",
    [
      ["xmlns", ODM_NS],
      ["xmlns:def", DEF_NS],
      ["xmlns:xlink", XLINK_NS],
      ["ODMVersion", CLINICAL_STANDARDS_PROFILE.ODM],
      ["FileType", "Snapshot"],
      ["FileOID", define.fileOid],
      ["CreationDateTime", define.createdAt],
      ["Originator", define.originator],
      ["SourceSystem", define.sourceSystem],
      ["SourceSystemVersion", define.sourceSystemVersion],
      ["Description", define.notice],
      ["def:Context", define.context],
    ],
    () =>
      xml.element("Study", [["OID", define.studyOid]], () => {
        xml.element("GlobalVariables", [], () => {
          xml.text("StudyName", define.studyName);
          xml.text("StudyDescription", define.studyDescription);
          xml.text("ProtocolName", define.protocolName);
        });
        xml.element(
          "MetaDataVersion",
          [
            ["OID", define.metaDataVersionOid],
            ["Name", define.metaDataVersionName],
            ["Description", define.metaDataVersionDescription],
            ["def:DefineVersion", define.defineVersion],
            ["def:CommentOID", define.commentOid],
          ],
          () => {
            xml.element("def:Standards", [], () => {
              for (const standard of define.standards) {
                writeStandard(xml, standard);
              }
            });
            for (const list of define.valueLists) {
              xml.element("def:ValueListDef", [["OID", list.oid]], () => {
                for (const ref of list.itemRefs) writeItemRef(xml, ref);
              });
            }
            for (const clause of define.whereClauses) {
              xml.element("def:WhereClauseDef", [["OID", clause.oid]], () =>
                xml.element(
                  "RangeCheck",
                  [
                    ["Comparator", clause.comparator],
                    ["SoftHard", "Soft"],
                    ["def:ItemOID", clause.itemOid],
                  ],
                  () => {
                    for (const value of clause.values) {
                      xml.text("CheckValue", value);
                    }
                  }
                )
              );
            }
            for (const group of define.itemGroups) writeItemGroup(xml, group);
            for (const item of define.items) writeItem(xml, item);
            for (const list of define.codeLists) writeCodeList(xml, list);
            for (const method of define.methods) {
              xml.element(
                "MethodDef",
                [
                  ["OID", method.oid],
                  ["Name", method.name],
                  ["Type", method.type],
                ],
                () => description(xml, "Description", method.description)
              );
            }
            for (const comment of define.comments) {
              xml.element("def:CommentDef", [["OID", comment.oid]], () =>
                description(xml, "Description", comment.text)
              );
            }
          }
        );
      })
  );
  return xml.toString();
}
