// @vitest-environment node
import { describe, it, expect } from "vitest";
import { cloneDeep } from "@/lib/utils";
import type { StudyProtocol, CRFForm, CRFField } from "@/lib/crf/types";

describe("cloneDeep utility", () => {
  it("clones primitive values and null/undefined without modification", () => {
    expect(cloneDeep(42)).toBe(42);
    expect(cloneDeep("hello")).toBe("hello");
    expect(cloneDeep(true)).toBe(true);
    expect(cloneDeep(null)).toBe(null);
    expect(cloneDeep(undefined)).toBe(undefined);
  });

  it("preserves Date instances using structuredClone", () => {
    const originalDate = new Date("2026-09-24T12:00:00Z");
    const obj = { createdAt: originalDate };

    const cloned = cloneDeep(obj);

    expect(cloned).not.toBe(obj);
    expect(cloned.createdAt).toBeInstanceOf(Date);
    expect(cloned.createdAt.getTime()).toBe(originalDate.getTime());
    expect(cloned.createdAt).not.toBe(originalDate);
  });

  it("preserves undefined properties using structuredClone", () => {
    const obj = { id: "123", note: undefined, count: 0 };

    const cloned = cloneDeep(obj);

    expect(cloned).not.toBe(obj);
    expect("note" in cloned).toBe(true);
    expect(cloned.note).toBeUndefined();
    expect(cloned).toEqual(obj);
  });

  it("preserves Map, Set, and RegExp instances", () => {
    const map = new Map<string, unknown>([["a", 1]]);
    const set = new Set<number>([1, 2, 3]);
    const reg = /test-pattern/gi;

    const container = { map, set, reg };
    const cloned = cloneDeep(container);

    expect(cloned).not.toBe(container);

    expect(cloned.map).toBeInstanceOf(Map);
    expect(cloned.map.get("a")).toBe(1);
    expect(cloned.map).not.toBe(map);

    expect(cloned.set).toBeInstanceOf(Set);
    expect(cloned.set.has(2)).toBe(true);
    expect(cloned.set).not.toBe(set);

    expect(cloned.reg).toBeInstanceOf(RegExp);
    expect(cloned.reg.source).toBe("test-pattern");
    expect(cloned.reg.flags).toBe("gi");
    expect(cloned.reg).not.toBe(reg);
  });

  it("falls back gracefully when objects contain non-serializable properties (e.g. functions)", () => {
    const originalDate = new Date("2026-09-24T12:00:00Z");
    const uncloneableObj = {
      name: "Form Handler",
      timestamp: originalDate,
      optionalNote: undefined,
      compute: function () {
        return "result";
      },
    };

    // structuredClone throws DataCloneError on functions, triggering the fallback
    const cloned = cloneDeep(uncloneableObj);

    expect(cloned).not.toBe(uncloneableObj);
    expect(cloned.name).toBe("Form Handler");
    expect(cloned.timestamp).toBeInstanceOf(Date);
    expect(cloned.timestamp.getTime()).toBe(originalDate.getTime());
    expect("optionalNote" in cloned).toBe(true);
    expect(cloned.optionalNote).toBeUndefined();
    expect(typeof cloned.compute).toBe("function");
    expect(cloned.compute()).toBe("result");
  });

  it("handles circular references in fallback mode", () => {
    interface CircularNode {
      name: string;
      fn?: () => void;
      self?: CircularNode;
    }

    const parent: CircularNode = { name: "Parent" };
    parent.fn = () => {}; // Triggers fallback
    parent.self = parent;

    const cloned = cloneDeep(parent);

    expect(cloned).not.toBe(parent);
    expect(cloned.name).toBe("Parent");
    expect(cloned.self).toBe(cloned);
  });

  it("verifies deep cloning accuracy and reference isolation for StudyProtocol", () => {
    const protocolDate = new Date("2026-05-01T10:00:00Z");
    const protocol: StudyProtocol = {
      id: "study_101",
      protocolNumber: "PROT-101",
      studyName: "Phase II Study",
      sponsor: "Acme Pharma",
      version: "1.0.0",
      lastModified: "2026-09-24T12:00:00Z",
      phase: "Phase II",
      therapeuticArea: "Oncology",
      forms: [
        {
          id: "form_dm",
          name: "Demographics",
          domain: "DM",
          description: "Demographics Form",
          version: "1.0.0",
          rules: [],
          sections: [
            {
              id: "sec_1",
              title: "General Info",
              fields: [
                {
                  id: "fld_age",
                  variableName: "AGE",
                  label: "Age in Years",
                  dataType: "number",
                  columnSpan: 6,
                  required: true,
                  description: undefined,
                },
              ],
            },
          ],
        },
      ],
      visits: [],
      codelists: [],
      rules: [],
    };

    const clonedProtocol = cloneDeep(protocol);

    // Guarantee complete reference isolation
    expect(clonedProtocol).not.toBe(protocol);
    expect(clonedProtocol.forms[0]).not.toBe(protocol.forms[0]);
    expect(clonedProtocol.forms[0].sections[0].fields[0]).not.toBe(
      protocol.forms[0].sections[0].fields[0]
    );

    // Verify Date timestamp preservation if Date instance was provided
    const protocolWithDate = {
      ...protocol,
      effectiveDate: protocolDate,
    };
    const clonedWithDate = cloneDeep(protocolWithDate);
    expect(clonedWithDate.effectiveDate).toBeInstanceOf(Date);
    if (clonedWithDate.effectiveDate instanceof Date) {
      expect(clonedWithDate.effectiveDate.getTime()).toBe(
        protocolDate.getTime()
      );
    }

    // Verify undefined properties remain intact
    expect("description" in clonedProtocol.forms[0].sections[0].fields[0]).toBe(
      true
    );
    expect(
      clonedProtocol.forms[0].sections[0].fields[0].description
    ).toBeUndefined();

    // Mutate source and verify clone remains unchanged
    protocol.forms[0].name = "Demographics Updated";
    expect(clonedProtocol.forms[0].name).toBe("Demographics");
  });

  it("verifies deep cloning accuracy for CRFForm and CRFField objects", () => {
    const field: CRFField = {
      id: "fld_sysbp",
      variableName: "SYSBP",
      label: "Systolic Blood Pressure",
      dataType: "number",
      columnSpan: 6,
      required: false,
      unit: "mmHg",
      description: undefined,
    };

    const form: CRFForm = {
      id: "form_vs",
      name: "Vital Signs",
      domain: "VS",
      description: "Vitals Form",
      version: "1.0.0",
      rules: [],
      sections: [
        {
          id: "sec_vs",
          title: "Vitals",
          fields: [field],
        },
      ],
    };

    const clonedForm = cloneDeep(form);
    const clonedField = cloneDeep(field);

    expect(clonedForm).not.toBe(form);
    expect(clonedForm.sections[0].fields[0]).not.toBe(field);
    expect("description" in clonedForm.sections[0].fields[0]).toBe(true);
    expect(clonedForm.sections[0].fields[0].description).toBeUndefined();

    expect(clonedField).not.toBe(field);
    expect("description" in clonedField).toBe(true);
    expect(clonedField.description).toBeUndefined();
  });

  it("clones ArrayBuffer, DataView, and TypedArray in fallback mode when structuredClone fails", () => {
    const rawBuffer = new ArrayBuffer(16);
    const u8 = new Uint8Array(rawBuffer);
    u8[0] = 42;
    u8[1] = 99;

    const view = new DataView(rawBuffer, 0, 8);
    const typedArray = new Uint8Array([1, 2, 3, 4]);

    const uncloneableObj = {
      buffer: rawBuffer,
      view: view,
      typedArray: typedArray,
      fn: () => "trigger fallback",
    };

    const cloned = cloneDeep(uncloneableObj);

    expect(cloned).not.toBe(uncloneableObj);

    // Verify ArrayBuffer cloning
    expect(cloned.buffer).toBeInstanceOf(ArrayBuffer);
    expect(cloned.buffer).not.toBe(rawBuffer);
    expect(cloned.buffer.byteLength).toBe(16);
    expect(new Uint8Array(cloned.buffer)[0]).toBe(42);

    // Verify DataView cloning
    expect(cloned.view).toBeInstanceOf(DataView);
    expect(cloned.view).not.toBe(view);
    expect(cloned.view.buffer).not.toBe(rawBuffer);
    expect(cloned.view.getUint8(0)).toBe(42);
    expect(cloned.view.getUint8(1)).toBe(99);

    // Verify TypedArray cloning
    expect(cloned.typedArray).toBeInstanceOf(Uint8Array);
    expect(cloned.typedArray).not.toBe(typedArray);
    expect(Array.from(cloned.typedArray)).toEqual([1, 2, 3, 4]);
  });
});
