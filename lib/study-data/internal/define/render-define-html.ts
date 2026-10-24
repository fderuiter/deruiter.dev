/**
 * A readable HTML view of a Define-XML document model: the pipeline's own
 * rendering, not the CDISC stylesheet. It returns one `article` element of
 * plain, semantic HTML (headings, tables, links between them) with no styles
 * or scripts, so a page can style it and a package can ship it as is.
 */
import type {
  DefineCodeList,
  DefineDocument,
  DefineItem,
  DefineItemGroup,
  DefineOrigin,
} from "./model";

/** Escapes text for HTML element content and quoted attribute values. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function table(
  caption: string,
  headings: readonly string[],
  rows: readonly (readonly string[])[]
): string {
  const head = headings
    .map((heading) => `<th scope="col">${escapeHtml(heading)}</th>`)
    .join("");
  const body = rows
    .map(
      (cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`
    )
    .join("\n");
  return `<table>\n<caption>${escapeHtml(caption)}</caption>\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table>`;
}

/**
 * Renders a Define-XML document model as readable HTML.
 *
 * The view lists the standards, the datasets, each dataset's variables with
 * their type, length, controlled terms, origin and method, the value-level
 * metadata, the codelists with their NCI codes and extended values, the
 * methods and the comments. Every anchor id starts with the layer, so the
 * SDTM and ADaM views can share one page.
 *
 * @param define - The model from `buildDefine`.
 * @returns One HTML `article` element as a string, with a trailing newline.
 */
export function renderDefineHtml(define: DefineDocument): string {
  const prefix = `define-${define.layer}-`;
  const anchor = (oid: string) => `${prefix}${oid}`;
  const link = (oid: string, text: string) =>
    `<a href="#${escapeHtml(anchor(oid))}">${escapeHtml(text)}</a>`;
  const itemsByOid = new Map(define.items.map((item) => [item.oid, item]));
  const codeListsByOid = new Map(
    define.codeLists.map((list) => [list.oid, list])
  );
  const methodsByOid = new Map(
    define.methods.map((method) => [method.oid, method])
  );
  const commentsByOid = new Map(
    define.comments.map((comment) => [comment.oid, comment])
  );
  const layerName = define.layer === "sdtm" ? "SDTM" : "ADaM";

  const originText = (origin: DefineOrigin) =>
    escapeHtml(
      [
        origin.type,
        origin.source ? `(${origin.source})` : "",
        origin.description ?? "",
      ]
        .filter((part) => part !== "")
        .join(" ")
    );
  const typeText = (item: DefineItem) =>
    escapeHtml(
      item.displayFormat
        ? `${item.dataType} (SAS ${item.displayFormat})`
        : item.dataType
    );
  const lengthText = (item: DefineItem) =>
    item.length === undefined
      ? ""
      : item.significantDigits === undefined
        ? String(item.length)
        : `${item.length} (${item.significantDigits} after the point)`;
  const termsText = (item: DefineItem) => {
    const parts: string[] = [];
    if (item.codeListOid) {
      const list = codeListsByOid.get(item.codeListOid);
      parts.push(link(item.codeListOid, list?.name ?? item.codeListOid));
    }
    if (item.valueListOid) {
      parts.push(link(item.valueListOid, "Value-level metadata"));
    }
    return parts.join("<br>");
  };

  const sections: string[] = [];
  sections.push(
    `<header>\n<h2 id="${escapeHtml(anchor("top"))}">${escapeHtml(`${layerName} Define-XML for ${define.studyId}`)}</h2>\n<p role="note"><strong>${escapeHtml(define.notice)}</strong></p>\n<p>${escapeHtml(define.studyDescription)}</p>\n<dl>\n<dt>Define-XML version</dt><dd>${escapeHtml(define.defineVersion)}</dd>\n<dt>Metadata version</dt><dd>${escapeHtml(`${define.metaDataVersionName} (${define.metaDataVersionOid})`)}</dd>\n<dt>Created</dt><dd>${escapeHtml(define.createdAt)}</dd>\n</dl>\n</header>`
  );

  sections.push(
    `<section aria-labelledby="${escapeHtml(anchor("standards"))}">\n<h3 id="${escapeHtml(anchor("standards"))}">Standards</h3>\n${table(
      "Standards",
      ["Standard", "Type", "Publishing set", "Version", "Status", "Comment"],
      define.standards.map((standard) => [
        escapeHtml(standard.name),
        escapeHtml(standard.type),
        escapeHtml(standard.publishingSet ?? ""),
        escapeHtml(standard.version),
        escapeHtml(standard.status),
        standard.commentOid
          ? escapeHtml(commentsByOid.get(standard.commentOid)?.text ?? "")
          : "",
      ])
    )}\n</section>`
  );

  sections.push(
    `<section aria-labelledby="${escapeHtml(anchor("datasets"))}">\n<h3 id="${escapeHtml(anchor("datasets"))}">Datasets</h3>\n${table(
      "Datasets",
      [
        "Dataset",
        "Description",
        "Class",
        "Structure",
        "Purpose",
        "Keys",
        "Records",
        "Location",
      ],
      define.itemGroups.map((group) => [
        link(group.oid, group.name),
        escapeHtml(group.label),
        escapeHtml(
          group.subClassName
            ? `${group.className} / ${group.subClassName}`
            : group.className
        ),
        escapeHtml(group.structure),
        escapeHtml(group.purpose),
        escapeHtml(group.keys.join(", ")),
        String(group.records),
        escapeHtml(group.leaf.href),
      ])
    )}\n</section>`
  );

  const variableRows = (group: DefineItemGroup) =>
    group.itemRefs.map((ref) => {
      const item = itemsByOid.get(ref.itemOid)!;
      const method = ref.methodOid
        ? methodsByOid.get(ref.methodOid)
        : undefined;
      return [
        escapeHtml(item.name),
        escapeHtml(item.label),
        ref.keySequence === undefined ? "" : String(ref.keySequence),
        typeText(item),
        lengthText(item),
        termsText(item),
        originText(item.origin),
        method ? link(method.oid, method.name) : "",
        escapeHtml(ref.role ?? ""),
      ];
    });
  for (const group of define.itemGroups) {
    sections.push(
      `<section aria-labelledby="${escapeHtml(anchor(group.oid))}">\n<h3 id="${escapeHtml(anchor(group.oid))}">${escapeHtml(`${group.name}: ${group.label}`)}</h3>\n${table(
        `${group.name} variables`,
        [
          "Variable",
          "Label",
          "Key",
          "Type",
          "Length",
          "Controlled terms",
          "Origin",
          "Method",
          "Role",
        ],
        variableRows(group)
      )}\n</section>`
    );
  }

  if (define.valueLists.length > 0) {
    const whereByOid = new Map(
      define.whereClauses.map((clause) => [clause.oid, clause])
    );
    const lists = define.valueLists.map(
      (list) =>
        `<section aria-labelledby="${escapeHtml(anchor(list.oid))}">\n<h4 id="${escapeHtml(anchor(list.oid))}">${escapeHtml(`${list.dataset}.${list.variable}`)}</h4>\n${table(
          `${list.dataset}.${list.variable} by parameter`,
          [
            "Where",
            "Label",
            "Type",
            "Length",
            "Controlled terms",
            "Origin",
            "Method",
          ],
          list.itemRefs.map((ref) => {
            const item = itemsByOid.get(ref.itemOid)!;
            const where = ref.whereClauseOid
              ? whereByOid.get(ref.whereClauseOid)
              : undefined;
            const method = ref.methodOid
              ? methodsByOid.get(ref.methodOid)
              : undefined;
            return [
              escapeHtml(
                where ? `${where.variable} = ${where.values.join(", ")}` : ""
              ),
              escapeHtml(item.label),
              typeText(item),
              lengthText(item),
              item.codeListOid
                ? link(
                    item.codeListOid,
                    codeListsByOid.get(item.codeListOid)?.name ??
                      item.codeListOid
                  )
                : "",
              originText(item.origin),
              method ? link(method.oid, method.name) : "",
            ];
          })
        )}\n</section>`
    );
    sections.push(
      `<section aria-labelledby="${escapeHtml(anchor("value-level"))}">\n<h3 id="${escapeHtml(anchor("value-level"))}">Value-level metadata</h3>\n${lists.join("\n")}\n</section>`
    );
  }

  const codeListSection = (list: DefineCodeList) => {
    const heading = [
      list.name,
      list.nciCode ? `NCI ${list.nciCode}` : "sponsor-defined",
      list.extensible === undefined
        ? ""
        : list.extensible
          ? "extensible"
          : "not extensible",
    ]
      .filter((part) => part !== "")
      .join(", ");
    return `<section aria-labelledby="${escapeHtml(anchor(list.oid))}">\n<h4 id="${escapeHtml(anchor(list.oid))}">${escapeHtml(heading)}</h4>\n${table(
      `${list.name} terms`,
      ["Value", "Decode", "NCI code", "Extended"],
      list.terms.map((term) => [
        escapeHtml(term.codedValue),
        escapeHtml(term.decode ?? ""),
        escapeHtml(term.nciCode ?? ""),
        term.extended ? "Yes, not in the CT subset" : "",
      ])
    )}\n</section>`;
  };
  sections.push(
    `<section aria-labelledby="${escapeHtml(anchor("codelists"))}">\n<h3 id="${escapeHtml(anchor("codelists"))}">Codelists</h3>\n${define.codeLists.map(codeListSection).join("\n")}\n</section>`
  );

  sections.push(
    `<section aria-labelledby="${escapeHtml(anchor("methods"))}">\n<h3 id="${escapeHtml(anchor("methods"))}">Methods</h3>\n<dl>\n${define.methods
      .map(
        (method) =>
          `<dt id="${escapeHtml(anchor(method.oid))}">${escapeHtml(`${method.name} (${method.type})`)}</dt><dd>${escapeHtml(method.description)}</dd>`
      )
      .join("\n")}\n</dl>\n</section>`
  );

  sections.push(
    `<section aria-labelledby="${escapeHtml(anchor("comments"))}">\n<h3 id="${escapeHtml(anchor("comments"))}">Comments</h3>\n<dl>\n${define.comments
      .map(
        (comment) =>
          `<dt id="${escapeHtml(anchor(comment.oid))}">${escapeHtml(comment.oid)}</dt><dd>${escapeHtml(comment.text)}</dd>`
      )
      .join("\n")}\n</dl>\n</section>`
  );

  return `<article class="define-xml" lang="en" data-layer="${define.layer}">\n${sections.join("\n")}\n</article>\n`;
}
