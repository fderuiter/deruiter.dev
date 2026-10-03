"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AstCondition,
  AstOperator,
  CRFField,
  CRFForm,
  EditCheckRule,
} from "@/lib/crf/types";
import {
  WIRE_ACTION_LABELS,
  WIRE_ACTION_TYPES,
  WIRE_EDITABLE_OPERATORS,
  buildRuleWireGraph,
  configureWireRule,
  connectWireSource,
  createWireRule,
  getConditionWireReadOnlyReason,
  removeWireCondition,
  setWireGroupOperator,
  setWireOuterOperator,
  updateWireCondition,
  type RuleWire,
  type WireActionType,
} from "@/lib/crf/rule-wires";
import { useResizeObserver } from "@/hooks/useResizeObserver";
import { AstRuleEditor } from "./AstRuleEditor";

interface RuleWireEditorProps {
  form: CRFForm;
  selectedField: CRFField | null;
  onUpdateRules: (rules: EditCheckRule[]) => void;
}

interface WireStyle {
  stroke: string;
  dash?: string;
  /** Text shown next to every wire so colour is never the only cue. */
  badge: string;
}

const ACTION_STYLES: Record<string, WireStyle> = {
  raise_query: { stroke: "#f59e0b", badge: "QUERY" },
  show_field: { stroke: "#10b981", dash: "7 3", badge: "SHOW" },
  hide_field: { stroke: "#94a3b8", dash: "2 3", badge: "HIDE" },
  require_field: { stroke: "#38bdf8", dash: "10 3 2 3", badge: "MANDATORY" },
  set_value: { stroke: "#a3e635", dash: "1 3", badge: "DERIVE" },
};
const UNSUPPORTED_STYLE: WireStyle = {
  stroke: "#f87171",
  dash: "4 4",
  badge: "READ-ONLY",
};

const OPERATOR_OPTIONS: Record<AstOperator, string> = {
  eq: "equals",
  neq: "does not equal",
  gt: "greater than",
  gte: "greater or equal",
  lt: "less than",
  lte: "less or equal",
  in: "is one of",
  contains: "contains",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

function styleFor(wire: RuleWire, ruleSupported: boolean): WireStyle {
  if (!ruleSupported) return UNSUPPORTED_STYLE;
  return ACTION_STYLES[wire.actionType] ?? UNSUPPORTED_STYLE;
}

interface Point {
  x: number;
  y: number;
}

interface Geometry {
  width: number;
  height: number;
  anchors: Record<string, Point>;
}

interface PendingConnection {
  sourceFieldId: string;
  targetFieldId: string;
}

interface DragState {
  sourceFieldId: string;
  start: Point;
  current: Point;
  moved: boolean;
}

const selectClass =
  "w-full min-w-0 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-white";

/**
 * Optional visual-wire view of a form's sentence rules (#674). It reads and
 * writes the same EditCheckRule objects as the sentence view, through the
 * pure operations in lib/crf/rule-wires.
 */
export const RuleWireEditor: React.FC<RuleWireEditorProps> = ({
  form,
  selectedField,
  onUpdateRules,
}) => {
  const allFields = useMemo(
    () => form.sections.flatMap((s) => s.fields),
    [form.sections]
  );
  const graph = useMemo(
    () => buildRuleWireGraph(form.rules, allFields),
    [form.rules, allFields]
  );

  const resolveRef = useCallback(
    (ref: string) =>
      allFields.find((f) => f.id === ref || f.variableName === ref)?.id ?? ref,
    [allFields]
  );
  const nameOf = useCallback(
    (ref: string) =>
      allFields.find((f) => f.id === ref || f.variableName === ref)
        ?.variableName ??
      (ref || "(no field)"),
    [allFields]
  );

  const relevantViews = useMemo(() => {
    if (!selectedField) return graph.rules;
    const id = selectedField.id;
    return graph.rules.filter(
      (view) =>
        resolveRef(view.targetFieldId) === id ||
        view.wires.some((w) => resolveRef(w.sourceFieldId) === id)
    );
  }, [graph.rules, selectedField, resolveRef]);
  const visibleWires = useMemo(
    () => relevantViews.flatMap((view) => view.wires),
    [relevantViews]
  );
  const supportedByRule = useMemo(
    () => new Map(graph.rules.map((view) => [view.ruleId, view.supported])),
    [graph.rules]
  );

  // Node columns: every form field, plus any reference a rule makes to a
  // field this form does not contain, so nothing is silently dropped.
  const nodeIds = useMemo(() => {
    const ids = allFields.map((f) => f.id);
    graph.wires.forEach((wire) => {
      [wire.sourceFieldId, wire.targetFieldId].forEach((ref) => {
        const resolved = resolveRef(ref);
        if (!ids.includes(resolved)) ids.push(resolved);
      });
    });
    return ids;
  }, [allFields, graph.wires, resolveRef]);
  const knownIds = useMemo(
    () => new Set(allFields.map((f) => f.id)),
    [allFields]
  );

  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [armedSourceId, setArmedSourceId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingConnection | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [status, setStatus] = useState("");
  const [geometry, setGeometry] = useState<Geometry>({
    width: 0,
    height: 0,
    anchors: {},
  });

  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const suppressClickRef = useRef(false);

  const measure = useCallback((container: HTMLElement | null) => {
    if (!container) return;
    const box = container.getBoundingClientRect();
    const anchors: Record<string, Point> = {};
    nodeRefs.current.forEach((el, key) => {
      const rect = el.getBoundingClientRect();
      anchors[key] = {
        x: key.startsWith("src:")
          ? rect.right - box.left
          : rect.left - box.left,
        y: rect.top - box.top + rect.height / 2,
      };
    });
    setGeometry({ width: box.width, height: box.height, anchors });
  }, []);

  const containerRef = useResizeObserver<HTMLDivElement>((entry) => {
    measure(entry.target as HTMLElement);
  }, true);

  const layoutKey = `${nodeIds.join("|")}#${visibleWires.map((w) => w.id).join("|")}`;
  useEffect(() => {
    if (typeof window === "undefined") return;
    const frame = window.requestAnimationFrame(() =>
      measure(containerRef.current)
    );
    return () => window.cancelAnimationFrame(frame);
  }, [layoutKey, measure, containerRef]);

  const registerNode = (key: string) => (el: HTMLElement | null) => {
    if (el) nodeRefs.current.set(key, el);
    else nodeRefs.current.delete(key);
  };

  const replaceRule = (next: EditCheckRule) => {
    onUpdateRules(form.rules.map((r) => (r.id === next.id ? next : r)));
  };

  const beginPending = (sourceFieldId: string, targetFieldId: string) => {
    setArmedSourceId(null);
    setPending({ sourceFieldId, targetFieldId });
    setStatus(
      `New connection from ${nameOf(sourceFieldId)} to ${nameOf(targetFieldId)}. Choose an action, then create it.`
    );
  };

  const handleSourceActivate = (fieldId: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (armedSourceId === fieldId) {
      setArmedSourceId(null);
      setStatus(`Cancelled connecting from ${nameOf(fieldId)}.`);
      return;
    }
    setArmedSourceId(fieldId);
    setStatus(
      `Connecting from ${nameOf(fieldId)}. Choose a target field, or press Escape to cancel.`
    );
  };

  const handleTargetActivate = (fieldId: string) => {
    if (armedSourceId) {
      beginPending(armedSourceId, fieldId);
      return;
    }
    const firstRule = graph.rules.find(
      (v) => resolveRef(v.targetFieldId) === fieldId
    );
    if (firstRule) {
      setSelectedRuleId(firstRule.ruleId);
      setStatus(`Configuring rule "${firstRule.ruleName}".`);
    } else {
      setStatus(
        `${nameOf(fieldId)} has no incoming connections. Choose a source field first.`
      );
    }
  };

  const localPoint = (e: React.PointerEvent): Point => {
    const box = containerRef.current?.getBoundingClientRect();
    return { x: e.clientX - (box?.left ?? 0), y: e.clientY - (box?.top ?? 0) };
  };

  const handlePointerDown =
    (fieldId: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      const point = localPoint(e);
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setDrag({
        sourceFieldId: fieldId,
        start: point,
        current: point,
        moved: false,
      });
    };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const point = localPoint(e);
    const moved =
      drag.moved ||
      Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > 4;
    setDrag({ ...drag, current: point, moved });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const current = drag;
    setDrag(null);
    if (!current.moved) return;
    suppressClickRef.current = true;
    const hit =
      typeof document.elementFromPoint === "function"
        ? document.elementFromPoint(e.clientX, e.clientY)
        : null;
    const target = hit?.closest<HTMLElement>("[data-wire-target-id]");
    const targetId = target?.dataset.wireTargetId;
    if (targetId) beginPending(current.sourceFieldId, targetId);
    else setStatus("Drag cancelled: release over a target field to connect.");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (armedSourceId || pending) {
      e.stopPropagation();
      setArmedSourceId(null);
      setPending(null);
      setStatus("Connection cancelled.");
    }
  };

  const handleCreate = (actionType: WireActionType, intoRuleId: string) => {
    if (!pending) return;
    if (intoRuleId !== "new") {
      const rule = form.rules.find((r) => r.id === intoRuleId);
      if (rule) {
        replaceRule(connectWireSource(rule, pending.sourceFieldId));
        setSelectedRuleId(rule.id);
        setStatus(
          `Connected ${nameOf(pending.sourceFieldId)} to rule "${rule.name}".`
        );
      }
    } else {
      const rule = createWireRule({
        id: `rule_wire_${Date.now()}`,
        sourceFieldId: pending.sourceFieldId,
        targetFieldId: pending.targetFieldId,
        actionType,
        fields: allFields,
      });
      onUpdateRules([...form.rules, rule]);
      setSelectedRuleId(rule.id);
      setStatus(`Created rule "${rule.name}". Configure it below.`);
    }
    setPending(null);
  };

  const selectedRule = form.rules.find((r) => r.id === selectedRuleId) ?? null;
  const selectedView =
    graph.rules.find((v) => v.ruleId === selectedRuleId) ?? null;

  const wirePath = (wire: RuleWire): string | null => {
    const a = geometry.anchors[`src:${resolveRef(wire.sourceFieldId)}`];
    const b = geometry.anchors[`tgt:${resolveRef(wire.targetFieldId)}`];
    if (!a || !b) return null;
    const bend = Math.max(24, (b.x - a.x) / 2);
    return `M ${a.x} ${a.y} C ${a.x + bend} ${a.y}, ${b.x - bend} ${b.y}, ${b.x} ${b.y}`;
  };

  const dragOrigin = drag
    ? geometry.anchors[`src:${drag.sourceFieldId}`]
    : undefined;

  return (
    <section
      aria-labelledby="rule-wire-heading"
      className="space-y-3 @container min-w-0"
      onKeyDown={handleKeyDown}
      data-testid="rule-wire-editor"
    >
      <div className="space-y-1">
        <h3
          id="rule-wire-heading"
          className="text-[11px] font-mono uppercase text-zinc-400 font-semibold"
        >
          Visual wires ({visibleWires.length} connections)
        </h3>
        <p className="text-[11px] text-zinc-500">
          The same rules as the sentence view. Choose a source field, then a
          target field, or drag between them. Every connection is also listed
          below.
        </p>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <NewConnectionForm fields={allFields} onBegin={beginPending} />

      {/* Diagram: real buttons laid out in two columns, with an SVG overlay
          drawing wires between their measured positions. */}
      <div
        ref={containerRef}
        className="relative w-full min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/70 p-2 section-isolate"
        data-testid="rule-wire-diagram"
      >
        <svg
          className="absolute inset-0 h-full w-full pointer-events-none"
          width={geometry.width || undefined}
          height={geometry.height || undefined}
          aria-hidden="true"
          focusable="false"
        >
          {visibleWires.map((wire) => {
            const d = wirePath(wire);
            if (!d) return null;
            const style = styleFor(
              wire,
              supportedByRule.get(wire.ruleId) ?? false
            );
            const selected = wire.ruleId === selectedRuleId;
            return (
              <path
                key={wire.id}
                d={d}
                data-wire-id={wire.id}
                fill="none"
                stroke={style.stroke}
                strokeDasharray={style.dash}
                strokeWidth={
                  selected ? 3 : wire.role === "condition" ? 1.75 : 1
                }
                strokeOpacity={
                  wire.role === "trigger" ? 0.5 : selected ? 1 : 0.75
                }
                className="motion-safe:transition-[stroke-width,stroke-opacity] motion-safe:duration-150"
              />
            );
          })}
          {drag?.moved && dragOrigin && (
            <line
              x1={dragOrigin.x}
              y1={dragOrigin.y}
              x2={drag.current.x}
              y2={drag.current.y}
              stroke="#f4f4f6"
              strokeDasharray="3 3"
              strokeWidth={1.5}
            />
          )}
        </svg>

        <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(1.5rem,0.5fr)_minmax(0,1fr)] gap-y-1">
          <div
            className="col-start-1 space-y-1 min-w-0"
            role="group"
            aria-label="Source fields"
          >
            <div className="text-[10px] font-mono uppercase text-zinc-500">
              Sources
            </div>
            {nodeIds.map((id) => (
              <button
                key={`src:${id}`}
                ref={registerNode(`src:${id}`)}
                type="button"
                aria-pressed={armedSourceId === id}
                aria-label={`Source ${nameOf(id)}${knownIds.has(id) ? "" : " (not on this form)"}`}
                onClick={() => handleSourceActivate(id)}
                onPointerDown={handlePointerDown(id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className={`block w-full min-w-0 truncate rounded border px-1.5 py-1 text-left font-mono text-[11px] touch-none active:scale-[0.98] ${
                  armedSourceId === id
                    ? "border-amber-500 bg-amber-950/40 text-amber-200"
                    : "border-zinc-800 bg-zinc-900 text-zinc-200 hover:border-zinc-700"
                }`}
              >
                {nameOf(id)}
                {knownIds.has(id) ? "" : " ?"}
              </button>
            ))}
          </div>
          <div
            className="col-start-3 space-y-1 min-w-0"
            role="group"
            aria-label="Target fields"
          >
            <div className="text-[10px] font-mono uppercase text-zinc-500 text-right">
              Targets
            </div>
            {nodeIds.map((id) => (
              <button
                key={`tgt:${id}`}
                ref={registerNode(`tgt:${id}`)}
                type="button"
                data-wire-target-id={id}
                aria-label={
                  armedSourceId
                    ? `Connect ${nameOf(armedSourceId)} to ${nameOf(id)}`
                    : `Target ${nameOf(id)}`
                }
                onClick={() => handleTargetActivate(id)}
                className={`block w-full min-w-0 truncate rounded border px-1.5 py-1 text-right font-mono text-[11px] active:scale-[0.98] ${
                  armedSourceId
                    ? "border-dashed border-amber-600 bg-zinc-900 text-zinc-100"
                    : "border-zinc-800 bg-zinc-900 text-zinc-200 hover:border-zinc-700"
                }`}
              >
                {nameOf(id)}
                {knownIds.has(id) ? "" : " ?"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <WireLegend />

      {pending && (
        <PendingConnectionPanel
          pending={pending}
          nameOf={nameOf}
          candidateRules={form.rules.filter(
            (r) =>
              resolveRef(r.targetFieldId) === pending.targetFieldId &&
              graph.rules.find((v) => v.ruleId === r.id)?.supported
          )}
          onCreate={handleCreate}
          onCancel={() => {
            setPending(null);
            setStatus("Connection cancelled.");
          }}
        />
      )}

      <div className="space-y-1.5">
        <h4 className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">
          Connection list
        </h4>
        {visibleWires.length === 0 ? (
          <p className="text-[11px] text-zinc-500">No connections yet.</p>
        ) : (
          <ul className="space-y-1" aria-label="Rule connections">
            {visibleWires.map((wire) => {
              const supported = supportedByRule.get(wire.ruleId) ?? false;
              const style = styleFor(wire, supported);
              const selected = wire.ruleId === selectedRuleId;
              return (
                <li key={wire.id} data-wire-id={wire.id} className="min-w-0">
                  <button
                    type="button"
                    aria-current={selected ? "true" : undefined}
                    onClick={() => {
                      setSelectedRuleId(wire.ruleId);
                      setStatus(`Configuring connection: ${wire.description}`);
                    }}
                    className={`flex w-full min-w-0 items-start gap-2 rounded border px-2 py-1.5 text-left text-[11px] active:scale-[0.98] ${
                      selected
                        ? "border-zinc-500 bg-zinc-900"
                        : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                    }`}
                  >
                    <span
                      className="mt-0.5 shrink-0 rounded border px-1 font-mono text-[9px] font-bold"
                      style={{ borderColor: style.stroke, color: style.stroke }}
                    >
                      {wire.role === "condition"
                        ? style.badge
                        : wire.role.toUpperCase()}
                    </span>
                    <span className="min-w-0 break-words text-zinc-300">
                      {wire.description}
                      {!wire.editable && wire.readOnlyReason ? (
                        <span className="block text-zinc-500">
                          {wire.readOnlyReason}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selectedRule && selectedView && (
        <RuleWireConfig
          key={selectedRule.id}
          rule={selectedRule}
          sentence={selectedView.sentence}
          readOnlyReason={selectedView.readOnlyReason}
          fields={allFields}
          nameOf={nameOf}
          onChange={replaceRule}
          onClose={() => setSelectedRuleId(null)}
        />
      )}
    </section>
  );
};

const WireLegend: React.FC = () => (
  <ul
    className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-zinc-400"
    aria-label="Wire legend"
  >
    {WIRE_ACTION_TYPES.map((action) => {
      const style = ACTION_STYLES[action];
      return (
        <li key={action} className="inline-flex items-center gap-1">
          <svg width="22" height="6" aria-hidden="true" focusable="false">
            <line
              x1="0"
              y1="3"
              x2="22"
              y2="3"
              stroke={style.stroke}
              strokeDasharray={style.dash}
              strokeWidth="2"
            />
          </svg>
          {WIRE_ACTION_LABELS[action]}
        </li>
      );
    })}
    <li className="inline-flex items-center gap-1">
      <svg width="22" height="6" aria-hidden="true" focusable="false">
        <line
          x1="0"
          y1="3"
          x2="22"
          y2="3"
          stroke={UNSUPPORTED_STYLE.stroke}
          strokeDasharray={UNSUPPORTED_STYLE.dash}
          strokeWidth="2"
        />
      </svg>
      Read-only
    </li>
  </ul>
);

interface NewConnectionFormProps {
  fields: CRFField[];
  onBegin: (sourceFieldId: string, targetFieldId: string) => void;
}

/** Non-pointer creation: pick both ends from lists. */
const NewConnectionForm: React.FC<NewConnectionFormProps> = ({
  fields,
  onBegin,
}) => {
  const [source, setSource] = useState(fields[0]?.id ?? "");
  const [target, setTarget] = useState(fields[1]?.id ?? fields[0]?.id ?? "");
  if (fields.length === 0) return null;
  return (
    <fieldset className="grid grid-cols-1 @xs:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 rounded-lg border border-zinc-800 p-2">
      <legend className="px-1 text-[10px] font-mono uppercase text-zinc-400">
        New connection
      </legend>
      <label className="block min-w-0 text-[10px] font-mono text-zinc-500">
        From source
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className={selectClass}
        >
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.variableName}
            </option>
          ))}
        </select>
      </label>
      <label className="block min-w-0 text-[10px] font-mono text-zinc-500">
        To target
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className={selectClass}
        >
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.variableName}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => onBegin(source, target)}
        className="rounded bg-zinc-800 px-2.5 py-1 font-mono text-[11px] text-white hover:bg-zinc-700 active:scale-[0.98]"
      >
        Connect
      </button>
    </fieldset>
  );
};

interface PendingConnectionPanelProps {
  pending: PendingConnection;
  nameOf: (ref: string) => string;
  candidateRules: EditCheckRule[];
  onCreate: (actionType: WireActionType, intoRuleId: string) => void;
  onCancel: () => void;
}

const PendingConnectionPanel: React.FC<PendingConnectionPanelProps> = ({
  pending,
  nameOf,
  candidateRules,
  onCreate,
  onCancel,
}) => {
  const [actionType, setActionType] = useState<WireActionType>("raise_query");
  const [into, setInto] = useState("new");
  const firstControl = useRef<HTMLSelectElement | null>(null);
  useEffect(() => {
    firstControl.current?.focus();
  }, []);
  return (
    <div
      role="group"
      aria-label="Configure new connection"
      className="space-y-2 rounded-lg border border-amber-700/60 bg-zinc-950 p-2.5"
    >
      <p className="text-[11px] font-mono text-zinc-200 break-words">
        {nameOf(pending.sourceFieldId)} → {nameOf(pending.targetFieldId)}
      </p>
      <label className="block text-[10px] font-mono text-zinc-500">
        Action
        <select
          ref={firstControl}
          value={actionType}
          disabled={into !== "new"}
          onChange={(e) => setActionType(e.target.value as WireActionType)}
          className={selectClass}
        >
          {WIRE_ACTION_TYPES.map((a) => (
            <option key={a} value={a}>
              {WIRE_ACTION_LABELS[a]}
            </option>
          ))}
        </select>
      </label>
      {candidateRules.length > 0 && (
        <label className="block text-[10px] font-mono text-zinc-500">
          Add to
          <select
            value={into}
            onChange={(e) => setInto(e.target.value)}
            className={selectClass}
          >
            <option value="new">A new rule</option>
            {candidateRules.map((r) => (
              <option key={r.id} value={r.id}>
                Existing rule: {r.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onCreate(actionType, into)}
          className="rounded bg-amber-500 px-2.5 py-1 font-mono text-[11px] font-bold text-black active:scale-[0.98]"
        >
          Create connection
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded bg-zinc-800 px-2.5 py-1 font-mono text-[11px] text-zinc-200 active:scale-[0.98]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

interface RuleWireConfigProps {
  rule: EditCheckRule;
  sentence: string;
  readOnlyReason?: string;
  fields: CRFField[];
  nameOf: (ref: string) => string;
  onChange: (rule: EditCheckRule) => void;
  onClose: () => void;
}

/** The configuration surface a selected connection opens. */
const RuleWireConfig: React.FC<RuleWireConfigProps> = ({
  rule,
  sentence,
  readOnlyReason,
  fields,
  nameOf,
  onChange,
  onClose,
}) => {
  const readOnly = readOnlyReason !== undefined;
  const grouped =
    Array.isArray(rule.conditionGroups) && rule.conditionGroups.length > 0;
  const groups = grouped
    ? (rule.conditionGroups ?? [])
    : [
        {
          id: "legacy",
          logicalOperator: rule.logicalOperator,
          conditions: rule.conditions ?? [],
        },
      ];
  const [addSource, setAddSource] = useState(fields[0]?.id ?? "");

  const condControl = (
    condition: AstCondition,
    groupIndex: number,
    conditionIndex: number
  ) => {
    const conditionReadOnly =
      readOnly || getConditionWireReadOnlyReason(condition) !== undefined;
    const location = { groupIndex, conditionIndex };
    const showValue =
      condition.operator !== "is_empty" &&
      condition.operator !== "is_not_empty";
    const prefix = `Group ${groupIndex + 1} condition ${conditionIndex + 1}`;
    return (
      <li
        key={conditionIndex}
        className="space-y-1 rounded border border-zinc-800 bg-zinc-900 p-1.5"
      >
        <div className="text-[10px] font-mono text-zinc-400 break-words">
          {nameOf(condition.fieldId)}
          {condition.crossVisitId ? ` at visit ${condition.crossVisitId}` : ""}
        </div>
        {conditionReadOnly ? (
          <p className="text-[11px] text-zinc-500 break-words">
            {OPERATOR_OPTIONS[condition.operator] ??
              `unsupported "${String(condition.operator)}"`}{" "}
            {Array.isArray(condition.value)
              ? `[${condition.value.join(", ")}]`
              : String(condition.value)}{" "}
            (read-only)
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            <select
              aria-label={`${prefix} operator`}
              value={condition.operator}
              onChange={(e) =>
                onChange(
                  updateWireCondition(rule, location, {
                    operator: e.target.value as AstOperator,
                  })
                )
              }
              className={selectClass}
            >
              {WIRE_EDITABLE_OPERATORS.map((op) => (
                <option key={op} value={op}>
                  {OPERATOR_OPTIONS[op]}
                </option>
              ))}
            </select>
            {showValue &&
              (condition.compareFieldId !== undefined ? (
                <select
                  aria-label={`${prefix} compared field`}
                  value={condition.compareFieldId}
                  onChange={(e) =>
                    onChange(
                      updateWireCondition(rule, location, {
                        compareFieldId: e.target.value,
                      })
                    )
                  }
                  className={selectClass}
                >
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.variableName}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label={`${prefix} value`}
                  type="text"
                  value={String(condition.value)}
                  onChange={(e) =>
                    onChange(
                      updateWireCondition(rule, location, {
                        value: e.target.value,
                      })
                    )
                  }
                  className={selectClass}
                />
              ))}
            <button
              type="button"
              onClick={() => onChange(removeWireCondition(rule, location))}
              className="col-span-2 justify-self-start text-[10px] font-mono text-zinc-400 underline hover:text-red-400"
            >
              Disconnect {nameOf(condition.fieldId)}
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div
      role="region"
      aria-label={`Configure rule ${rule.name}`}
      className="space-y-2.5 rounded-xl border border-zinc-700 bg-zinc-950/80 p-3"
      data-testid="rule-wire-config"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-xs font-bold font-mono text-white break-words">
          {rule.name}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded bg-zinc-900 px-2 py-0.5 font-mono text-[11px] text-zinc-300 hover:bg-zinc-800"
        >
          Close
        </button>
      </div>

      <p
        className="rounded border border-zinc-800 bg-zinc-900 p-2 text-[11px] text-zinc-200 break-words"
        data-testid="rule-wire-sentence"
      >
        {sentence}
      </p>

      {readOnly && (
        <p className="rounded border border-red-800 bg-red-950/40 p-2 text-[11px] text-red-300 break-words">
          {readOnlyReason}
        </p>
      )}

      <div className="grid grid-cols-1 @xs:grid-cols-2 gap-2">
        <label className="block min-w-0 text-[10px] font-mono text-zinc-500">
          Action
          <select
            value={rule.actionType}
            disabled={readOnly}
            onChange={(e) =>
              onChange(
                configureWireRule(rule, {
                  actionType: e.target.value as WireActionType,
                })
              )
            }
            className={selectClass}
          >
            {WIRE_ACTION_TYPES.map((a) => (
              <option key={a} value={a}>
                {WIRE_ACTION_LABELS[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0 text-[10px] font-mono text-zinc-500">
          Target
          <select
            value={rule.targetFieldId}
            disabled={readOnly}
            onChange={(e) =>
              onChange(
                configureWireRule(rule, { targetFieldId: e.target.value })
              )
            }
            className={selectClass}
          >
            {!fields.some((f) => f.id === rule.targetFieldId) && (
              <option value={rule.targetFieldId}>
                {nameOf(rule.targetFieldId)}
              </option>
            )}
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.variableName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {grouped && groups.length > 1 && (
        <label className="block text-[10px] font-mono text-zinc-500">
          Groups combine with
          <select
            value={rule.groupLogicalOperator ?? "AND"}
            disabled={readOnly}
            onChange={(e) =>
              onChange(
                setWireOuterOperator(rule, e.target.value as "AND" | "OR")
              )
            }
            className={selectClass}
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
        </label>
      )}

      {groups.map((group, groupIndex) => (
        <fieldset
          key={group.id}
          className="space-y-1.5 rounded-lg border border-zinc-800 p-2"
        >
          <legend className="px-1 text-[10px] font-mono uppercase text-zinc-400">
            Group {groupIndex + 1}
          </legend>
          <label className="block text-[10px] font-mono text-zinc-500">
            Conditions combine with
            <select
              value={group.logicalOperator}
              disabled={readOnly}
              onChange={(e) =>
                onChange(
                  setWireGroupOperator(
                    rule,
                    groupIndex,
                    e.target.value as "AND" | "OR"
                  )
                )
              }
              className={selectClass}
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </select>
          </label>
          {group.conditions.length === 0 ? (
            <p className="text-[11px] text-zinc-500">
              No conditions: always true.
            </p>
          ) : (
            <ul className="space-y-1">
              {group.conditions.map((c, ci) => condControl(c, groupIndex, ci))}
            </ul>
          )}
          {!readOnly && (
            <div className="flex items-end gap-1.5">
              <label className="block min-w-0 flex-1 text-[10px] font-mono text-zinc-500">
                Connect another source
                <select
                  value={addSource}
                  onChange={(e) => setAddSource(e.target.value)}
                  className={selectClass}
                >
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.variableName}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() =>
                  onChange(connectWireSource(rule, addSource, groupIndex))
                }
                className="shrink-0 rounded bg-zinc-800 px-2 py-1 font-mono text-[11px] text-white hover:bg-zinc-700"
              >
                Add to group {groupIndex + 1}
              </button>
            </div>
          )}
        </fieldset>
      ))}

      {rule.actionType === "raise_query" && (
        <div className="grid grid-cols-1 gap-2">
          <label className="block text-[10px] font-mono text-zinc-500">
            Query severity
            <select
              value={rule.querySeverity ?? "warning"}
              disabled={readOnly}
              onChange={(e) =>
                onChange(
                  configureWireRule(rule, {
                    querySeverity: e.target
                      .value as EditCheckRule["querySeverity"],
                  })
                )
              }
              className={selectClass}
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Hard error</option>
            </select>
          </label>
          <label className="block text-[10px] font-mono text-zinc-500">
            Query text
            <textarea
              rows={2}
              value={rule.queryMessage ?? ""}
              disabled={readOnly}
              onChange={(e) =>
                onChange(
                  configureWireRule(rule, { queryMessage: e.target.value })
                )
              }
              className={`${selectClass} resize-none`}
            />
          </label>
        </div>
      )}

      {rule.actionType === "set_value" && (
        <AstRuleEditor
          formula={rule.formulaExpression ?? ""}
          readOnly={readOnly}
          onChange={(formulaExpression) =>
            onChange(configureWireRule(rule, { formulaExpression }))
          }
          fields={fields}
          label="Derivation formula"
        />
      )}
    </div>
  );
};
