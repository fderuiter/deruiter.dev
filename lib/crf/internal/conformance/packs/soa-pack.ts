import type {
  ConformanceEvaluationContext,
  ConformanceFinding,
  ConformanceRulePack,
} from "../types";

/**
 * Declarative Schedule of Activities (SoA) conformance rule pack.
 * Scoped exclusively to `"study"` evaluations so single-form audits never emit
 * false `SD0005` orphan diagnostics.
 */
export const SOA_CONFORMANCE_PACK: ConformanceRulePack = {
  id: "soa",
  name: "Schedule of Activities Matrix Consistency Pack",
  version: "1.0.0",
  rules: [
    {
      ruleId: "SD0005",
      description:
        "Non-log forms must be scheduled in at least one study visit in the Schedule of Activities (SoA)",
      defaultSeverity: "warning",
      tier: "soa",
      evaluate(ctx: ConformanceEvaluationContext): ConformanceFinding[] {
        if (ctx.scope !== "study") return [];

        const { document } = ctx;
        const assignedFormIds = new Set<string>();
        for (const visitId of document.visits.order) {
          const visit = document.visits.byId[visitId];
          if (!visit) continue;
          for (const fid of visit.assignedFormIds || []) {
            assignedFormIds.add(fid);
          }
          for (const fid of visit.formIds || []) {
            assignedFormIds.add(fid);
          }
        }

        const firstVisit =
          document.visits.order.length > 0
            ? document.visits.byId[document.visits.order[0]]
            : undefined;

        const findings: ConformanceFinding[] = [];
        for (const formId of document.forms.order) {
          const form = document.forms.byId[formId]?.form;
          if (!form) continue;
          if (!form.isLogForm && !assignedFormIds.has(form.id)) {
            findings.push({
              id: `SD0005_${form.id}`,
              packId: "soa",
              packVersion: "1.0.0",
              tier: "soa",
              ruleId: "SD0005",
              legacyEngineRule: "SOA-ORPHAN",
              ruleDescription:
                "Form is not assigned to any visit in Schedule of Activities (SoA)",
              severity: "warning",
              formId: form.id,
              formName: form.name,
              formDomain: form.domain,
              location: `Form "${form.name}"`,
              message: `Form '${form.name}' (${form.domain}) is defined but not assigned to any study visit in the visit schedule.`,
              autoFixAvailable: document.visits.order.length > 0,
              autoFixType: "assign_visit_form",
              suggestedFix: firstVisit
                ? `Assign '${form.name}' to ${firstVisit.name}`
                : "Create a study visit and assign this form",
            });
          }
        }

        return findings;
      },
    },
    {
      ruleId: "SOA-MISSING-FORM",
      description:
        "Every form ID referenced by a study visit must exist in the protocol forms table",
      defaultSeverity: "error",
      tier: "soa",
      evaluate(ctx: ConformanceEvaluationContext): ConformanceFinding[] {
        if (ctx.scope !== "study") return [];

        const { document } = ctx;
        const findings: ConformanceFinding[] = [];

        for (const visitId of document.visits.order) {
          const visit = document.visits.byId[visitId];
          if (!visit) continue;
          const refs = new Set<string>([
            ...(visit.assignedFormIds || []),
            ...(visit.formIds || []),
          ]);
          for (const refFormId of refs) {
            if (!document.forms.byId[refFormId]) {
              findings.push({
                id: `SOA_MISSING_FORM_${visit.id}_${refFormId}`,
                packId: "soa",
                packVersion: "1.0.0",
                tier: "soa",
                ruleId: "SOA-MISSING-FORM",
                legacyEngineRule: "SOA-MISSING-FORM",
                ruleDescription:
                  "Visit schedule references a non-existent CRF form ID",
                severity: "error",
                formId: refFormId,
                formName: "SOA",
                formDomain: "SOA",
                location: `Visit "${visit.name}"`,
                message: `Visit '${visit.name}' references non-existent form ID '${refFormId}'`,
                autoFixAvailable: false,
              });
            }
          }
        }

        return findings;
      },
    },
  ],
};
