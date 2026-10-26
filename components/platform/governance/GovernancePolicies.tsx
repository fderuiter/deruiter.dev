import { GOVERNANCE_POLICIES } from "@/lib/clinical-platform";
import { policyAnchor } from "./labels";

/**
 * The governance policies, each with its purpose and rules. A rule says
 * which platform export applies it, or that a person applies it in review.
 */
export function GovernancePolicies() {
  return (
    <div className="@container min-w-0">
      <ul className="grid gap-3 @4xl:grid-cols-2">
        {GOVERNANCE_POLICIES.map((policy) => (
          <li
            key={policy.id}
            id={policyAnchor(policy.id)}
            tabIndex={-1}
            className="min-w-0 scroll-mt-24 border border-white/[0.08] bg-[#13151a] p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <h3 className="text-base font-semibold text-[#f4f4f6]">
              {policy.title}
            </h3>
            <p className="mt-2 text-sm text-slate-300">{policy.purpose}</p>
            <ol className="mt-3 space-y-3 text-sm">
              {policy.rules.map((rule) => (
                <li
                  key={rule.text}
                  className="border-l-2 border-white/[0.12] pl-3"
                >
                  <p className="leading-relaxed text-slate-200">{rule.text}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {rule.appliedBy === null ? (
                      "Applied by a person in review."
                    ) : (
                      <>
                        Applied in code by{" "}
                        <code className="break-all font-mono text-slate-300">
                          {rule.appliedBy}
                        </code>
                        .
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </div>
  );
}
