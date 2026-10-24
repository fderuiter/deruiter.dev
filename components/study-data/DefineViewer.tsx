"use client";

import { useId, useState } from "react";
import type { DefineDocument, DefineItem } from "@/lib/study-data";
import { BUTTON_SECONDARY, CELL, FIELD, TABLE_SCROLL } from "./ui";

interface DefineViewerProps {
  readonly define: {
    readonly sdtm: DefineDocument;
    readonly adam: DefineDocument;
  };
}

function typeText(item: DefineItem): string {
  const parts: string[] = [item.dataType];
  if (item.length !== undefined) parts.push(String(item.length));
  if (item.significantDigits !== undefined) {
    parts.push(`.${item.significantDigits}`);
  }
  return parts.length > 1
    ? `${parts[0]} (${parts.slice(1).join("")})`
    : parts[0];
}

/**
 * The Define-XML 2.1 metadata of a run, rendered from the same document
 * model `writeDefineXml` serialises: standards, then one dataset at a time
 * with its variables, value-level metadata, codelists and methods.
 */
export function DefineViewer({ define }: DefineViewerProps) {
  const [layer, setLayer] = useState<"sdtm" | "adam">("adam");
  const doc = define[layer];
  const [groupOid, setGroupOid] = useState(doc.itemGroups[0]?.oid ?? "");
  const selectId = useId();
  const group =
    doc.itemGroups.find((item) => item.oid === groupOid) ?? doc.itemGroups[0];
  const items = new Map(doc.items.map((item) => [item.oid, item]));
  const codeLists = new Map(doc.codeLists.map((list) => [list.oid, list]));
  const methods = new Map(doc.methods.map((method) => [method.oid, method]));
  const valueLists = doc.valueLists.filter(
    (list) => list.dataset === group?.name
  );
  const whereClauses = new Map(
    doc.whereClauses.map((clause) => [clause.oid, clause])
  );
  const usedCodeLists = new Set<string>();
  const usedMethods = new Set<string>();
  for (const ref of group?.itemRefs ?? []) {
    const item = items.get(ref.itemOid);
    if (item?.codeListOid) usedCodeLists.add(item.codeListOid);
    if (ref.methodOid) usedMethods.add(ref.methodOid);
  }

  const chooseLayer = (next: "sdtm" | "adam") => {
    setLayer(next);
    setGroupOid(define[next].itemGroups[0]?.oid ?? "");
  };

  if (!group) return null;
  return (
    <div className="min-w-0 space-y-6">
      <p className="max-w-3xl text-sm leading-relaxed text-slate-300">
        Define-XML {doc.defineVersion} metadata, generated from the same
        variable specifications as the datasets. The downloaded package carries
        the XML beside each layer&apos;s datasets.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div
          className="flex gap-2"
          role="group"
          aria-label="Define-XML document"
        >
          {(["sdtm", "adam"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={layer === option}
              onClick={() => chooseLayer(option)}
              className={`${BUTTON_SECONDARY} min-h-12 ${layer === option ? "border-amber-500/60 bg-amber-500/10 text-amber-100" : ""}`}
            >
              {option === "sdtm" ? "SDTM define.xml" : "ADaM define.xml"}
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1 sm:max-w-md">
          <label
            htmlFor={selectId}
            className="mb-1 block font-mono text-xs uppercase tracking-[0.14em] text-slate-300"
          >
            Dataset
          </label>
          <select
            id={selectId}
            value={group.oid}
            onChange={(event) => setGroupOid(event.target.value)}
            className={FIELD}
          >
            {doc.itemGroups.map((item) => (
              <option key={item.oid} value={item.oid}>
                {item.name} · {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={TABLE_SCROLL}>
        <table className="w-full border-collapse">
          <caption className="px-3 pb-2 pt-3 text-left text-sm font-semibold text-white">
            Standards
          </caption>
          <thead>
            <tr className="border-y border-white/[0.12] text-slate-300">
              {["Standard", "Type", "Version", "Status"].map((heading) => (
                <th key={heading} scope="col" className={`${CELL} font-sans`}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-slate-100">
            {doc.standards.map((standard) => (
              <tr key={standard.oid} className="border-b border-white/[0.04]">
                <th scope="row" className={`${CELL} font-semibold`}>
                  {standard.name}
                  {standard.publishingSet ? ` (${standard.publishingSet})` : ""}
                </th>
                <td className={CELL}>{standard.type}</td>
                <td className={CELL}>{standard.version}</td>
                <td className={CELL}>{standard.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="grid min-w-0 gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Dataset", `${group.name} · ${group.label}`],
          [
            "Class",
            group.subClassName
              ? `${group.className} · ${group.subClassName}`
              : group.className,
          ],
          ["Structure", group.structure],
          ["Keys", group.keys.join(", ")],
          ["Purpose", group.purpose],
          ["Records", group.records.toLocaleString("en-US")],
          ["File", group.leaf.href],
        ].map(([term, value]) => (
          <div key={term} className="min-w-0">
            <dt className="text-slate-400">{term}</dt>
            <dd className="break-words font-mono text-slate-100">{value}</dd>
          </div>
        ))}
      </dl>

      <div className={TABLE_SCROLL}>
        <table className="w-full border-collapse">
          <caption className="px-3 pb-2 pt-3 text-left text-sm font-semibold text-white">
            {group.name} variables
          </caption>
          <thead>
            <tr className="border-y border-white/[0.12] text-slate-300">
              {[
                "Variable",
                "Label",
                "Type",
                "Key",
                "Codelist",
                "Origin",
                "Method",
              ].map((heading) => (
                <th key={heading} scope="col" className={`${CELL} font-sans`}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-slate-100">
            {group.itemRefs.map((ref) => {
              const item = items.get(ref.itemOid);
              if (!item) return null;
              const list = item.codeListOid
                ? codeLists.get(item.codeListOid)
                : undefined;
              const method = ref.methodOid
                ? methods.get(ref.methodOid)
                : undefined;
              return (
                <tr key={ref.itemOid} className="border-b border-white/[0.04]">
                  <th
                    scope="row"
                    className={`${CELL} font-semibold text-amber-200`}
                  >
                    {item.name}
                  </th>
                  <td className="min-w-[12rem] px-3 py-2 text-xs">
                    {item.label}
                  </td>
                  <td className={CELL}>{typeText(item)}</td>
                  <td className={CELL}>{ref.keySequence ?? ""}</td>
                  <td className={CELL}>
                    {list
                      ? `${list.name}${list.nciCode ? ` (${list.nciCode})` : ""}`
                      : ""}
                  </td>
                  <td className="min-w-[10rem] px-3 py-2 text-xs">
                    {item.origin.type}
                    {item.origin.source ? ` · ${item.origin.source}` : ""}
                    {item.origin.description ? (
                      <span className="block text-slate-400">
                        {item.origin.description}
                      </span>
                    ) : null}
                  </td>
                  <td className="min-w-[10rem] px-3 py-2 text-xs">
                    {method?.name ?? ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {valueLists.length > 0 ? (
        <div className={TABLE_SCROLL}>
          <table className="w-full border-collapse">
            <caption className="px-3 pb-2 pt-3 text-left text-sm font-semibold text-white">
              Value-level metadata
            </caption>
            <thead>
              <tr className="border-y border-white/[0.12] text-slate-300">
                {["Variable", "Where", "Label", "Type", "Origin"].map(
                  (heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className={`${CELL} font-sans`}
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="text-slate-100">
              {valueLists.flatMap((list) =>
                list.itemRefs.map((ref) => {
                  const item = items.get(ref.itemOid);
                  const clause = ref.whereClauseOid
                    ? whereClauses.get(ref.whereClauseOid)
                    : undefined;
                  if (!item) return null;
                  return (
                    <tr
                      key={`${list.oid}-${ref.itemOid}`}
                      className="border-b border-white/[0.04]"
                    >
                      <th scope="row" className={`${CELL} font-semibold`}>
                        {list.variable}
                      </th>
                      <td className={CELL}>
                        {clause
                          ? `${clause.variable} = ${clause.values.join(", ")}`
                          : ""}
                      </td>
                      <td className="min-w-[12rem] px-3 py-2 text-xs">
                        {item.label}
                      </td>
                      <td className={CELL}>{typeText(item)}</td>
                      <td className={CELL}>{item.origin.type}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <section aria-label="Codelists" className="min-w-0 space-y-3">
          <h3 className="text-lg font-semibold tracking-[-0.035em] text-white">
            Codelists
          </h3>
          {usedCodeLists.size === 0 ? (
            <p className="text-sm text-slate-400">
              No variable of {group.name} has a codelist.
            </p>
          ) : (
            [...usedCodeLists].map((oid) => {
              const list = codeLists.get(oid);
              if (!list) return null;
              return (
                <details
                  key={oid}
                  className="border border-white/[0.08] bg-[#0d0e11]"
                >
                  <summary className="flex min-h-12 cursor-pointer items-center px-3 text-sm text-slate-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-400">
                    <span className="font-mono text-amber-200">{list.id}</span>
                    <span className="ml-2 break-words">
                      {list.name}
                      {list.nciCode ? ` · ${list.nciCode}` : ""}
                      {list.extensible === undefined
                        ? ""
                        : list.extensible
                          ? " · extensible"
                          : " · not extensible"}
                    </span>
                  </summary>
                  <ul className="space-y-1 px-3 pb-3 text-xs text-slate-200">
                    {list.terms.map((term) => (
                      <li
                        key={term.codedValue}
                        className="break-words font-mono"
                      >
                        {term.codedValue}
                        {term.decode ? ` · ${term.decode}` : ""}
                        {term.nciCode ? ` · ${term.nciCode}` : ""}
                        {term.extended ? " · sponsor extension" : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })
          )}
        </section>
        <section aria-label="Methods" className="min-w-0 space-y-3">
          <h3 className="text-lg font-semibold tracking-[-0.035em] text-white">
            Methods
          </h3>
          {usedMethods.size === 0 ? (
            <p className="text-sm text-slate-400">
              No variable of {group.name} is derived by a method.
            </p>
          ) : (
            <dl className="space-y-3">
              {[...usedMethods].map((oid) => {
                const method = methods.get(oid);
                if (!method) return null;
                return (
                  <div
                    key={oid}
                    className="border-l-2 border-white/[0.12] pl-3"
                  >
                    <dt className="text-sm font-semibold text-white">
                      {method.name}{" "}
                      <span className="font-mono text-xs font-normal text-slate-400">
                        {method.type}
                      </span>
                    </dt>
                    <dd className="mt-1 break-words text-xs leading-relaxed text-slate-300">
                      {method.description}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
        </section>
      </div>
    </div>
  );
}
