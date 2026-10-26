"use client";

import { useEffect } from "react";
import { dqRuleAnchor } from "./labels";

/**
 * Opens the closed rule group a link points into, then lands on the rule.
 * Not every browser opens a closed details element for a fragment, and a
 * link from the trend or the issue log can name a rule that passes today.
 */
export function RuleGroupReveal() {
  useEffect(() => {
    const reveal = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id.startsWith(dqRuleAnchor(""))) return;
      const target = document.getElementById(id);
      const group = target?.closest("details");
      if (!target || !group || group.open) return;
      group.open = true;
      target.scrollIntoView({ block: "start" });
      target.focus({ preventScroll: true });
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);
  return null;
}
