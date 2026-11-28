"use client";

import React, { useMemo, useState } from "react";
import {
  CRFForm,
  CRFField,
  EditCheckRule,
  AstCondition,
  ConditionGroup,
} from "@/lib/crf/types";
import { explainRule, describeRuleLogic } from "@/lib/crf";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { AstRuleEditor } from "./AstRuleEditor";
import { RuleWireEditor } from "./RuleWireEditor";
import { TooltipButton } from "@/components/ui/Tooltip";

interface LogicRulesTabProps {
  form: CRFForm;
  selectedField: CRFField | null;
  onUpdateRules: (rules: EditCheckRule[]) => void;
}

/** Legacy flat conditions/logicalOperator, displayed as a single implicit group when conditionGroups hasn't been authored yet (#540). */
function getDisplayGroups(rule: EditCheckRule): ConditionGroup[] {
  if (rule.conditionGroups && rule.conditionGroups.length > 0) {
    return rule.conditionGroups;
  }
  return [
    {
      id: `${rule.id}_group_1`,
      logicalOperator: rule.logicalOperator,
      conditions: rule.conditions,
    },
  ];
}

/** Every fieldId referenced by a rule's conditions (as the compared field or the compare-to field), for the Test Values panel. */
function getReferencedFieldIds(rule: EditCheckRule): string[] {
  const ids = new Set<string>();
  getDisplayGroups(rule).forEach((group) => {
    group.conditions.forEach((cond) => {
      ids.add(cond.fieldId);
      if (cond.compareFieldId) ids.add(cond.compareFieldId);
    });
  });
  return Array.from(ids);
}

export const LogicRulesTab: React.FC<LogicRulesTabProps> = ({
  form,
  selectedField,
  onUpdateRules,
}) => {
  const allFields = form.sections.flatMap((s) => s.fields);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  // Optional visual-wire view over the same rules (#674).
  const [view, setView] = useState<"sentences" | "wires">("sentences");

  const handleAddRule = () => {
    const newRule: EditCheckRule = {
      id: `rule_${Date.now()}`,
      name: selectedField
        ? `Rule for ${selectedField.variableName}`
        : "New Clinical Edit Check",
      description: "Conditional logic rule",
      triggerFieldIds: selectedField
        ? [selectedField.id]
        : allFields[0]
          ? [allFields[0].id]
          : [],
      actionType: "raise_query",
      targetFieldId: selectedField
        ? selectedField.id
        : allFields[0]
          ? allFields[0].id
          : "",
      conditions: [
        {
          fieldId: selectedField
            ? selectedField.id
            : allFields[0]
              ? allFields[0].id
              : "",
          operator: "gt",
          value: 100,
        },
      ],
      logicalOperator: "AND",
      querySeverity: "warning",
      queryMessage: "Value exceeds protocol threshold. Please confirm.",
    };

    onUpdateRules([...form.rules, newRule]);
    setEditingRuleId(newRule.id);
  };

  const handleDeleteRule = (ruleId: string) => {
    onUpdateRules(form.rules.filter((r) => r.id !== ruleId));
  };

  const handleUpdateRule = (
    ruleId: string,
    updates: Partial<EditCheckRule>
  ) => {
    onUpdateRules(
      form.rules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r))
    );
  };

  // Writes conditionGroups/groupLogicalOperator (the source of truth once a
  // rule has been touched in this editor) and mirrors the first group back
  // onto the legacy conditions/logicalOperator fields so any other code
  // still reading them directly sees a reasonable approximation (#540).
  const commitGroups = (
    rule: EditCheckRule,
    groups: ConditionGroup[],
    groupLogicalOperator: "AND" | "OR"
  ) => {
    const first = groups[0];
    handleUpdateRule(rule.id, {
      conditionGroups: groups,
      groupLogicalOperator,
      conditions: first ? first.conditions : [],
      logicalOperator: first ? first.logicalOperator : "AND",
    });
  };

  const handleAddGroup = (rule: EditCheckRule) => {
    const groups = getDisplayGroups(rule);
    const newGroup: ConditionGroup = {
      id: `group_${Date.now()}`,
      logicalOperator: "AND",
      conditions: [
        {
          fieldId: allFields[0] ? allFields[0].id : "",
          operator: "eq",
          value: "",
        },
      ],
    };
    commitGroups(
      rule,
      [...groups, newGroup],
      rule.groupLogicalOperator ?? "AND"
    );
  };

  const handleDeleteGroup = (rule: EditCheckRule, groupIdx: number) => {
    const groups = getDisplayGroups(rule).filter((_, i) => i !== groupIdx);
    commitGroups(
      rule,
      groups.length > 0
        ? groups
        : [
            {
              id: `group_${Date.now()}`,
              logicalOperator: "AND",
              conditions: [],
            },
          ],
      rule.groupLogicalOperator ?? "AND"
    );
  };

  const handleToggleGroupOperator = (rule: EditCheckRule, groupIdx: number) => {
    const groups = getDisplayGroups(rule).map((g, i) =>
      i === groupIdx
        ? {
            ...g,
            logicalOperator: (g.logicalOperator === "AND" ? "OR" : "AND") as
              "AND" | "OR",
          }
        : g
    );
    commitGroups(rule, groups, rule.groupLogicalOperator ?? "AND");
  };

  const handleToggleOuterOperator = (rule: EditCheckRule) => {
    commitGroups(
      rule,
      getDisplayGroups(rule),
      (rule.groupLogicalOperator ?? "AND") === "AND" ? "OR" : "AND"
    );
  };

  const handleAddCondition = (rule: EditCheckRule, groupIdx: number) => {
    const newCond: AstCondition = {
      fieldId: allFields[0] ? allFields[0].id : "",
      operator: "eq",
      value: "",
    };
    const groups = getDisplayGroups(rule).map((g, i) =>
      i === groupIdx ? { ...g, conditions: [...g.conditions, newCond] } : g
    );
    commitGroups(rule, groups, rule.groupLogicalOperator ?? "AND");
  };

  const handleUpdateCondition = (
    rule: EditCheckRule,
    groupIdx: number,
    condIdx: number,
    updates: Partial<AstCondition>
  ) => {
    const groups = getDisplayGroups(rule).map((g, gi) =>
      gi === groupIdx
        ? {
            ...g,
            conditions: g.conditions.map((c, ci) =>
              ci === condIdx ? { ...c, ...updates } : c
            ),
          }
        : g
    );
    commitGroups(rule, groups, rule.groupLogicalOperator ?? "AND");
  };

  const handleDeleteCondition = (
    rule: EditCheckRule,
    groupIdx: number,
    condIdx: number
  ) => {
    const groups = getDisplayGroups(rule).map((g, gi) =>
      gi === groupIdx
        ? { ...g, conditions: g.conditions.filter((_, ci) => ci !== condIdx) }
        : g
    );
    commitGroups(rule, groups, rule.groupLogicalOperator ?? "AND");
  };

  // Filter rules relevant to selected field or show all if none selected
  const relevantRules = selectedField
    ? form.rules.filter(
        (r) =>
          r.targetFieldId === selectedField.id ||
          r.triggerFieldIds.includes(selectedField.id)
      )
    : form.rules;

  return (
    <div className="space-y-4 p-4 text-xs font-sans">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-mono uppercase studio-fg-muted font-semibold">
            {selectedField
              ? `Rules for ${selectedField.variableName}`
              : "Form Edit Checks"}{" "}
            ({relevantRules.length})
          </span>
        </div>
        <button
          onClick={handleAddRule}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg studio-accent-cyan studio-hover-cyan font-mono text-xs font-bold transition-all"
        >
          <IconPlus className="w-3.5 h-3.5" />
          <span>Add Rule</span>
        </button>
      </div>

      <div
        role="group"
        aria-label="Rule view"
        className="inline-flex rounded-lg border studio-border-default p-0.5"
      >
        {(["sentences", "wires"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={`px-2 py-0.5 rounded font-mono text-[11px] ${
              view === v
                ? "studio-surface-muted studio-fg-primary"
                : "studio-fg-muted studio-hover-fg-primary"
            }`}
          >
            {v === "sentences" ? "Sentences" : "Visual wires"}
          </button>
        ))}
      </div>

      {view === "wires" ? (
        <RuleWireEditor
          form={form}
          selectedField={selectedField}
          onUpdateRules={onUpdateRules}
        />
      ) : relevantRules.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed studio-border-default text-center space-y-2">
          <p className="studio-fg-muted font-mono text-xs">
            No active edit checks or logic rules.
          </p>
          <p className="text-[11px] studio-fg-muted">
            Create conditional show/hide branching, cross-field validation range
            checks, or automated discrepancy queries.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {relevantRules.map((rule) => {
            const isEditing = editingRuleId === rule.id;

            return (
              <div
                key={rule.id}
                className="p-3.5 rounded-xl studio-surface-subtle border studio-border-default space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-xs font-bold studio-fg-primary font-mono truncate">
                      {rule.name}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono studio-fg-muted flex-wrap">
                      <span className="px-1.5 py-0.2 rounded studio-surface-card border studio-border-default studio-fg-cyan font-bold">
                        {rule.actionType}
                      </span>
                      <span className="studio-fg-muted">→</span>
                      <span className="studio-fg-secondary">
                        Target:{" "}
                        {allFields.find((f) => f.id === rule.targetFieldId)
                          ?.variableName || rule.targetFieldId}
                      </span>
                      {(() => {
                        const totalConditions = getDisplayGroups(rule).reduce(
                          (sum, g) => sum + g.conditions.length,
                          0
                        );
                        return totalConditions > 0 ? (
                          <span className="px-1.5 py-0.2 rounded studio-surface-card studio-fg-muted border studio-border-default">
                            {totalConditions}{" "}
                            {totalConditions === 1 ? "condition" : "conditions"}
                          </span>
                        ) : null;
                      })()}
                      {rule.unsupportedExpression && (
                        <span
                          className="px-1.5 py-0.2 rounded studio-accent-red-strong border font-bold"
                          title={rule.unsupportedExpression.reason}
                        >
                          Unsupported expression: will not fire
                        </span>
                      )}
                    </div>
                    <p
                      className="text-[11px] studio-fg-muted break-words"
                      data-testid="rule-sentence"
                    >
                      {describeRuleLogic(rule, allFields)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setEditingRuleId(isEditing ? null : rule.id)
                      }
                      className="px-2 py-0.5 rounded studio-surface-card studio-hover-surface studio-fg-secondary font-mono text-[11px]"
                    >
                      {isEditing ? "Close" : "Configure"}
                    </button>
                    <TooltipButton
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1 studio-fg-muted studio-hover-fg-red transition-colors"
                      tooltip="Delete Rule"
                      aria-label="Delete Rule"
                    >
                      <IconTrash className="w-3.5 h-3.5" />
                    </TooltipButton>
                  </div>
                </div>

                {isEditing && (
                  <div className="pt-3 border-t studio-border-default space-y-3">
                    <div>
                      <label className="block text-[10px] font-mono studio-fg-muted mb-1">
                        Rule Name
                      </label>
                      <input
                        type="text"
                        value={rule.name}
                        onChange={(e) =>
                          handleUpdateRule(rule.id, { name: e.target.value })
                        }
                        className="w-full px-2.5 py-1 studio-surface-card border studio-border-default rounded text-xs studio-fg-primary"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-mono studio-fg-muted mb-1">
                          Action Type
                        </label>
                        <select
                          value={rule.actionType}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, {
                              actionType: e.target
                                .value as EditCheckRule["actionType"],
                            })
                          }
                          className="w-full px-2 py-1 studio-surface-card border studio-border-default rounded text-xs studio-fg-primary"
                        >
                          <option value="show_field">Show Field</option>
                          <option value="hide_field">Hide Field</option>
                          <option value="require_field">
                            Make Field Mandatory
                          </option>
                          <option value="raise_query">
                            Raise EDC Discrepancy Query
                          </option>
                          <option value="set_value">
                            Set Derived Value (Formula)
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono studio-fg-muted mb-1">
                          Target Field
                        </label>
                        <select
                          value={rule.targetFieldId}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, {
                              targetFieldId: e.target.value,
                            })
                          }
                          className="w-full px-2 py-1 studio-surface-card border studio-border-default rounded text-xs studio-fg-primary"
                        >
                          {allFields.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.variableName} ({f.label.slice(0, 20)}...)
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Conditions, grouped (#540): each group has its own AND/OR;
                        groups are combined by an outer AND/OR when there's more than one. */}
                    <ConditionGroupsEditor
                      rule={rule}
                      allFields={allFields}
                      onAddGroup={() => handleAddGroup(rule)}
                      onDeleteGroup={(gIdx) => handleDeleteGroup(rule, gIdx)}
                      onToggleGroupOperator={(gIdx) =>
                        handleToggleGroupOperator(rule, gIdx)
                      }
                      onToggleOuterOperator={() =>
                        handleToggleOuterOperator(rule)
                      }
                      onAddCondition={(gIdx) => handleAddCondition(rule, gIdx)}
                      onUpdateCondition={(gIdx, cIdx, updates) =>
                        handleUpdateCondition(rule, gIdx, cIdx, updates)
                      }
                      onDeleteCondition={(gIdx, cIdx) =>
                        handleDeleteCondition(rule, gIdx, cIdx)
                      }
                    />

                    {/* Test Values & Explained Result (#540): lets an author try
                        sample values and see the truth-table-style reasoning
                        without needing the live form/simulator. */}
                    <RuleExplanationPanel rule={rule} allFields={allFields} />

                    {/* Derived Calculation Formula if Action is set_value */}
                    {rule.actionType === "set_value" && (
                      <div className="pt-2 border-t studio-border-default">
                        <AstRuleEditor
                          formula={rule.formulaExpression || ""}
                          onChange={(newFormula) =>
                            handleUpdateRule(rule.id, {
                              formulaExpression: newFormula,
                            })
                          }
                          fields={allFields}
                          label="Derived Rule Formula"
                          placeholder="e.g. weight / ((height/100) * (height/100))"
                        />
                      </div>
                    )}

                    {/* Query Message if Action is raise_query */}
                    {rule.actionType === "raise_query" && (
                      <div className="space-y-2 pt-1 border-t studio-border-default">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-mono studio-fg-muted mb-1">
                              Query Severity
                            </label>
                            <select
                              value={rule.querySeverity || "warning"}
                              onChange={(e) =>
                                handleUpdateRule(rule.id, {
                                  querySeverity: e.target
                                    .value as EditCheckRule["querySeverity"],
                                })
                              }
                              className="w-full px-2 py-1 studio-surface-card border studio-border-default rounded text-xs studio-fg-primary"
                            >
                              <option value="info">Info / Notice</option>
                              <option value="warning">
                                Warning (Requires Explanation)
                              </option>
                              <option value="error">
                                Hard Error (Blocks Submission)
                              </option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono studio-fg-muted mb-1">
                            Query Text (Discrepancy message shown to site)
                          </label>
                          <textarea
                            rows={2}
                            value={rule.queryMessage || ""}
                            onChange={(e) =>
                              handleUpdateRule(rule.id, {
                                queryMessage: e.target.value,
                              })
                            }
                            className="w-full px-2.5 py-1.5 studio-surface-card border studio-border-default rounded text-xs studio-fg-primary resize-none font-sans"
                            placeholder="e.g. Diastolic Blood Pressure exceeds systolic threshold."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface ConditionGroupsEditorProps {
  rule: EditCheckRule;
  allFields: CRFField[];
  onAddGroup: () => void;
  onDeleteGroup: (groupIdx: number) => void;
  onToggleGroupOperator: (groupIdx: number) => void;
  onToggleOuterOperator: () => void;
  onAddCondition: (groupIdx: number) => void;
  onUpdateCondition: (
    groupIdx: number,
    condIdx: number,
    updates: Partial<AstCondition>
  ) => void;
  onDeleteCondition: (groupIdx: number, condIdx: number) => void;
}

const ConditionGroupsEditor: React.FC<ConditionGroupsEditorProps> = ({
  rule,
  allFields,
  onAddGroup,
  onDeleteGroup,
  onToggleGroupOperator,
  onToggleOuterOperator,
  onAddCondition,
  onUpdateCondition,
  onDeleteCondition,
}) => {
  const groups = getDisplayGroups(rule);
  const outerOperator = rule.groupLogicalOperator ?? "AND";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono studio-fg-muted font-semibold uppercase">
          Conditions
          {groups.length > 1 ? ` (groups combined with ${outerOperator})` : ""}
        </span>
        <div className="flex items-center gap-2">
          {groups.length > 1 && (
            <TooltipButton
              onClick={onToggleOuterOperator}
              className="text-[10px] font-mono px-1.5 py-0.2 rounded studio-surface-card border studio-border-default studio-fg-cyan"
              tooltip="Toggle how groups are combined"
            >
              Groups: {outerOperator}
            </TooltipButton>
          )}
          <button
            onClick={onAddGroup}
            className="text-[10px] font-mono studio-fg-cyan hover:underline"
          >
            + Group
          </button>
        </div>
      </div>

      {groups.map((group, gIdx) => (
        <div
          key={group.id}
          className="p-2 rounded-lg studio-surface-card border studio-border-default space-y-2"
        >
          <div className="flex items-center justify-between">
            <TooltipButton
              onClick={() => onToggleGroupOperator(gIdx)}
              className="text-[10px] font-mono px-1.5 py-0.2 rounded studio-surface-card border studio-border-default studio-fg-cyan"
              tooltip="Toggle AND/OR within this group"
            >
              Group {gIdx + 1}: {group.logicalOperator}
            </TooltipButton>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onAddCondition(gIdx)}
                className="text-[10px] font-mono studio-fg-cyan hover:underline"
              >
                + Condition
              </button>
              {groups.length > 1 && (
                <TooltipButton
                  onClick={() => onDeleteGroup(gIdx)}
                  className="p-1 studio-fg-muted studio-hover-fg-red"
                  tooltip="Delete Group"
                  aria-label="Delete Group"
                >
                  <IconTrash className="w-3 h-3" />
                </TooltipButton>
              )}
            </div>
          </div>

          {group.conditions.map((cond, cIdx) => {
            const showValue =
              cond.operator !== "is_empty" && cond.operator !== "is_not_empty";
            const compareMode: "literal" | "field" =
              cond.compareFieldId !== undefined ? "field" : "literal";

            return (
              <div
                key={cIdx}
                className="p-2 rounded-lg studio-surface-card border studio-border-default space-y-1.5"
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <select
                    value={cond.fieldId}
                    onChange={(e) =>
                      onUpdateCondition(gIdx, cIdx, { fieldId: e.target.value })
                    }
                    className="flex-1 min-w-[90px] px-1.5 py-1 studio-surface-subtle border studio-border-default rounded text-[11px] studio-fg-primary font-mono"
                  >
                    {allFields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.variableName}
                      </option>
                    ))}
                  </select>

                  <select
                    value={cond.operator}
                    onChange={(e) =>
                      onUpdateCondition(gIdx, cIdx, {
                        operator: e.target.value as AstCondition["operator"],
                      })
                    }
                    className="w-24 px-1.5 py-1 studio-surface-subtle border studio-border-default rounded text-[11px] studio-fg-primary font-mono"
                  >
                    <option value="eq">== (Equals)</option>
                    <option value="neq">!= (Not Equals)</option>
                    <option value="gt">&gt; (Greater)</option>
                    <option value="gte">&gt;= (Greater/Eq)</option>
                    <option value="lt">&lt; (Less)</option>
                    <option value="lte">&lt;= (Less/Eq)</option>
                    <option value="contains">Contains</option>
                    <option value="is_empty">Is Empty</option>
                    <option value="is_not_empty">Is Not Empty</option>
                  </select>

                  {showValue && (
                    <select
                      value={compareMode}
                      onChange={(e) => {
                        if (e.target.value === "field") {
                          onUpdateCondition(gIdx, cIdx, {
                            compareFieldId: allFields[0] ? allFields[0].id : "",
                          });
                        } else {
                          onUpdateCondition(gIdx, cIdx, {
                            compareFieldId: undefined,
                          });
                        }
                      }}
                      className="w-16 px-1 py-1 studio-surface-subtle border studio-border-default rounded text-[10px] studio-fg-muted font-mono"
                      title="Compare against a literal value or another field"
                    >
                      <option value="literal">Value</option>
                      <option value="field">Field</option>
                    </select>
                  )}

                  {showValue && compareMode === "literal" && (
                    <input
                      type="text"
                      value={String(cond.value)}
                      onChange={(e) =>
                        onUpdateCondition(gIdx, cIdx, { value: e.target.value })
                      }
                      className="w-20 px-1.5 py-1 studio-surface-subtle border studio-border-default rounded text-[11px] studio-fg-primary font-mono"
                      placeholder="Value"
                    />
                  )}

                  {showValue && compareMode === "field" && (
                    <select
                      value={cond.compareFieldId || ""}
                      onChange={(e) =>
                        onUpdateCondition(gIdx, cIdx, {
                          compareFieldId: e.target.value,
                        })
                      }
                      className="flex-1 min-w-[90px] px-1.5 py-1 studio-surface-subtle border studio-border-default rounded text-[11px] studio-fg-primary font-mono"
                    >
                      {allFields.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.variableName}
                        </option>
                      ))}
                    </select>
                  )}

                  {group.conditions.length > 1 && (
                    <button
                      onClick={() => onDeleteCondition(gIdx, cIdx)}
                      className="p-1 studio-fg-muted studio-hover-fg-red"
                    >
                      <IconTrash className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

interface RuleExplanationPanelProps {
  rule: EditCheckRule;
  allFields: CRFField[];
}

/** Live "edit -> test values -> explained result" panel (#540): lets an
 * author try sample field values and see the truth-table-style reasoning
 * behind the rule's current result without needing the live simulator. */
const RuleExplanationPanel: React.FC<RuleExplanationPanelProps> = ({
  rule,
  allFields,
}) => {
  const referencedFieldIds = useMemo(() => getReferencedFieldIds(rule), [rule]);
  const [testValues, setTestValues] = useState<Record<string, string>>({});

  const fieldValues = useMemo(() => {
    const values: Record<string, string | number | boolean | null | undefined> =
      {};
    referencedFieldIds.forEach((fieldId) => {
      values[fieldId] = testValues[fieldId] ?? "";
    });
    return values;
  }, [referencedFieldIds, testValues]);

  const explanation = useMemo(
    () => explainRule(rule, fieldValues, allFields),
    [rule, fieldValues, allFields]
  );

  const resultStyle =
    explanation.result === "true"
      ? "studio-accent-emerald"
      : explanation.result === "false"
        ? "studio-fg-muted studio-border-default studio-surface-card"
        : explanation.result === "missing"
          ? "studio-accent-amber"
          : "studio-accent-red";

  return (
    <div className="space-y-2 pt-2 border-t studio-border-default">
      <span className="text-[10px] font-mono studio-fg-muted font-semibold uppercase">
        Test Values &amp; Explained Result
      </span>

      {referencedFieldIds.length === 0 ? (
        <p className="text-[11px] studio-fg-muted">
          Add a condition to test sample values.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {referencedFieldIds.map((fieldId) => {
            const field = allFields.find(
              (f) => f.id === fieldId || f.variableName === fieldId
            );
            return (
              <div key={fieldId} className="flex items-center gap-1">
                <label
                  className="text-[10px] font-mono studio-fg-muted w-20 truncate shrink-0"
                  title={field?.variableName || fieldId}
                >
                  {field?.variableName || fieldId}
                </label>
                <input
                  type="text"
                  value={testValues[fieldId] ?? ""}
                  onChange={(e) =>
                    setTestValues((prev) => ({
                      ...prev,
                      [fieldId]: e.target.value,
                    }))
                  }
                  placeholder="test value"
                  className="flex-1 min-w-0 px-1.5 py-0.5 studio-surface-subtle border studio-border-default rounded text-[11px] studio-fg-primary font-mono"
                />
              </div>
            );
          })}
        </div>
      )}

      <div
        className={`p-2 rounded-lg border text-[11px] font-mono space-y-1 ${resultStyle}`}
      >
        {explanation.groupExplanations.map((g, i) => (
          <div key={g.group.id ?? i} className="break-words">
            {g.sentence}
          </div>
        ))}
        <div className="font-bold pt-1 border-t border-current/20 break-words">
          {explanation.summary}
        </div>
      </div>
    </div>
  );
};
