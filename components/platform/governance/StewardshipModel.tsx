import {
  GOVERNANCE_DECISIONS,
  GOVERNANCE_DOMAINS,
  GOVERNANCE_POLICIES,
  STEWARDSHIP_ROLES,
} from "@/lib/clinical-platform";
import { RACI_LABEL, policyAnchor } from "./labels";

const POLICY_TITLE = Object.fromEntries(
  GOVERNANCE_POLICIES.map((p) => [p.id, p.title])
);

/**
 * The stewardship model: the domains that own the platform's data and the
 * roles each holds, the four stewardship roles and their duties, and who
 * does what in each key decision.
 */
export function StewardshipModel() {
  return (
    <div className="@container min-w-0 space-y-10">
      <div>
        <h3 className="text-lg font-semibold tracking-[-0.02em]">Domains</h3>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Each product and metric names an owner and a steward from the same
          domain, and the catalog checks that every role it names is in one.
        </p>
        <ul className="mt-4 grid gap-3 @3xl:grid-cols-2 @6xl:grid-cols-3">
          {GOVERNANCE_DOMAINS.map((domain) => (
            <li
              key={domain.id}
              className="min-w-0 border border-white/[0.08] bg-[#13151a] p-4"
            >
              <h4 className="text-base font-semibold text-[#f4f4f6]">
                {domain.name}
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {domain.summary}
              </p>
              <dl className="mt-3 grid gap-3 text-xs @sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-slate-400">Owners</dt>
                  <dd>
                    <ul className="mt-1 space-y-1 text-slate-200">
                      {domain.owners.map((role) => (
                        <li key={role}>{role}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-slate-400">Stewards</dt>
                  <dd>
                    <ul className="mt-1 space-y-1 text-slate-200">
                      {domain.stewards.map((role) => (
                        <li key={role}>{role}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-semibold tracking-[-0.02em]">Roles</h3>
        <ul className="mt-4 grid gap-3 @3xl:grid-cols-2">
          {STEWARDSHIP_ROLES.map((role) => (
            <li
              key={role.id}
              className="min-w-0 border border-white/[0.08] bg-[#13151a] p-4"
            >
              <h4 className="text-base font-semibold text-[#f4f4f6]">
                {role.name}
              </h4>
              <p className="mt-1 text-xs text-slate-400">
                Held by: {role.heldBy}
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
                {role.duties.map((duty) => (
                  <li key={duty}>{duty}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-semibold tracking-[-0.02em]">
          Who decides what
        </h3>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Each decision has exactly one accountable role and at least one
          responsible role, and applies one of the policies below.
        </p>
        <div
          className="mt-4 overflow-x-auto border border-white/[0.08]"
          tabIndex={0}
          role="region"
          aria-label="Decisions and stewardship roles"
        >
          <table className="w-full border-collapse text-left text-xs">
            <caption className="sr-only">
              Who is responsible, accountable, consulted and informed in each
              key governance decision
            </caption>
            <thead className="bg-[#13151a]">
              <tr>
                <th
                  scope="col"
                  className="min-w-52 px-3 py-2 font-medium text-slate-300"
                >
                  Decision
                </th>
                {STEWARDSHIP_ROLES.map((role) => (
                  <th
                    key={role.id}
                    scope="col"
                    className="whitespace-nowrap px-3 py-2 font-medium text-slate-300"
                  >
                    {role.name}
                  </th>
                ))}
                <th
                  scope="col"
                  className="whitespace-nowrap px-3 py-2 font-medium text-slate-300"
                >
                  Policy
                </th>
              </tr>
            </thead>
            <tbody>
              {GOVERNANCE_DECISIONS.map((decision) => (
                <tr
                  key={decision.id}
                  className="border-t border-white/[0.06] align-top"
                >
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <span className="block font-semibold text-slate-100">
                      {decision.name}
                    </span>
                    <span className="mt-1 block text-slate-400">
                      {decision.when}
                    </span>
                  </th>
                  {STEWARDSHIP_ROLES.map((role) => {
                    const code = decision.raci[role.id];
                    return (
                      <td
                        key={role.id}
                        className="whitespace-nowrap px-3 py-2 text-slate-200"
                      >
                        {code === null ? (
                          <span className="text-slate-400">No part</span>
                        ) : (
                          <>
                            <span
                              aria-hidden="true"
                              className={`mr-1.5 font-mono font-semibold ${code === "A" ? "text-amber-300" : "text-slate-100"}`}
                            >
                              {code}
                            </span>
                            {RACI_LABEL[code]}
                          </>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2">
                    <a
                      href={`#${policyAnchor(decision.policy)}`}
                      className="text-amber-300 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-amber-400"
                    >
                      {POLICY_TITLE[decision.policy] ?? decision.policy}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
