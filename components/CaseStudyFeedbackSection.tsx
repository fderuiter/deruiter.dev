"use client";

import React, { useState, useEffect } from "react";
import {
  IconBulb,
  IconFlame,
  IconTarget,
  IconSearch,
  IconCheck,
  IconMessageCode,
  IconSend,
  IconAlertCircle,
  IconLoader2,
} from "@tabler/icons-react";
import { isProductionEnvironment } from "@/lib/env";
import { useOfflineQueue, getOfflineQueue } from "@/hooks/useOfflineQueue";
import { validateConstructiveContent } from "@/lib/moderation";
import { logger } from "@/lib/logger";
import { apiClient } from "@/lib/api-client";

interface CaseStudyFeedbackSectionProps {
  slug: string;
}

export const PREDEFINED_TAKEAWAYS = [
  "Architecture & System Design",
  "Error Handling & Resilience",
  "Testing Protocols & QA",
  "Performance Optimization",
  "Security & Privacy Practice",
  "Developer Experience (DX)",
] as const;

type ReactionType = "insightful" | "mind_blowing" | "actionable" | "thorough";

interface ReactionsResponse {
  counts?: Record<string, number>;
  userReactions?: string[];
}

interface FeedbackStatusResponse {
  hasSubmitted?: boolean;
}

interface FeedbackSubmitResponse {
  message?: string;
}

interface ReactionConfig {
  type: ReactionType;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const REACTIONS: ReactionConfig[] = [
  { type: "insightful", label: "Insightful", icon: IconBulb },
  { type: "mind_blowing", label: "Mind-Blowing", icon: IconFlame },
  { type: "actionable", label: "Actionable", icon: IconTarget },
  { type: "thorough", label: "Thorough", icon: IconSearch },
];

export function CaseStudyFeedbackSection({
  slug,
}: CaseStudyFeedbackSectionProps) {
  const { enqueue } = useOfflineQueue();

  // Reactions state
  const [counts, setCounts] = useState<Record<string, number>>({
    insightful: 0,
    mind_blowing: 0,
    actionable: 0,
    thorough: 0,
  });
  const [userReactions, setUserReactions] = useState<string[]>([]);
  const [reactionLoading, setReactionLoading] = useState<string | null>(null);

  // Feedback form state
  const [selectedTakeaways, setSelectedTakeaways] = useState<string[]>([]);
  const [comments, setComments] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [hasSubmittedFeedback, setHasSubmittedFeedback] =
    useState<boolean>(false);

  // Initial fetch for reaction counts and submission status
  useEffect(() => {
    let isMounted = true;

    async function loadReactionsAndStatus() {
      try {
        const [rxRes, fbRes] = await Promise.all([
          apiClient.get<ReactionsResponse>(
            `/api/case-studies/reactions?slug=${encodeURIComponent(slug)}`
          ),
          apiClient.get<FeedbackStatusResponse>(
            `/api/case-studies/feedback?slug=${encodeURIComponent(slug)}`
          ),
        ]);

        if (rxRes.data && isMounted) {
          if (rxRes.data.counts) {
            setCounts(rxRes.data.counts);
          }
          if (rxRes.data.userReactions) {
            setUserReactions(rxRes.data.userReactions);
          }
        }

        if (fbRes.data?.hasSubmitted && isMounted) {
          setHasSubmittedFeedback(true);
        }

        if (
          (rxRes.networkError || fbRes.networkError) &&
          !isProductionEnvironment()
        ) {
          logger.error(
            "Failed to load case study reaction/feedback status: network error"
          );
        }
      } finally {
        if (isMounted) {
          const pendingItems = getOfflineQueue();
          for (const item of pendingItems) {
            if (item.endpoint === "/api/case-studies/reactions" && item.body) {
              const body = item.body as {
                caseStudySlug?: string;
                reactionType?: string;
              };
              if (body.caseStudySlug === slug && body.reactionType) {
                setUserReactions((prev) =>
                  prev.includes(body.reactionType!)
                    ? prev
                    : [...prev, body.reactionType!]
                );
                setCounts((prev) => ({
                  ...prev,
                  [body.reactionType!]: (prev[body.reactionType!] || 0) + 1,
                }));
              }
            } else if (
              item.endpoint === "/api/case-studies/feedback" &&
              item.body
            ) {
              const body = item.body as { caseStudySlug?: string };
              if (body.caseStudySlug === slug) {
                setHasSubmittedFeedback(true);
                setSuccessMsg(
                  "Thank you! Your learning feedback has been recorded."
                );
              }
            }
          }
        }
      }
    }

    loadReactionsAndStatus();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  // Handle Quick Reaction click
  const handleReactionClick = async (type: ReactionType) => {
    if (reactionLoading) return;
    setReactionLoading(type);

    // Optimistic UI update
    const alreadyReacted = userReactions.includes(type);

    if (!alreadyReacted) {
      setCounts((prev) => ({ ...prev, [type]: (prev[type] || 0) + 1 }));
      setUserReactions((prev) => [...prev, type]);
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueue({
        type: "reaction",
        endpoint: "/api/case-studies/reactions",
        body: { caseStudySlug: slug, reactionType: type },
      });
      setReactionLoading(null);
      return;
    }

    const res = await apiClient.post<ReactionsResponse>(
      "/api/case-studies/reactions",
      { caseStudySlug: slug, reactionType: type }
    );

    if (res.ok) {
      if (res.data?.counts) {
        setCounts(res.data.counts);
      }
      if (res.data?.userReactions) {
        setUserReactions(res.data.userReactions);
      }
    } else {
      enqueue({
        type: "reaction",
        endpoint: "/api/case-studies/reactions",
        body: { caseStudySlug: slug, reactionType: type },
      });
    }
    setReactionLoading(null);
  };

  // Toggle takeaway selection
  const toggleTakeaway = (takeaway: string) => {
    setErrorMsg(null);
    setSelectedTakeaways((prev) =>
      prev.includes(takeaway)
        ? prev.filter((t) => t !== takeaway)
        : [...prev, takeaway]
    );
  };

  // Handle Feedback Submission
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Client-side pre-validation
    if (selectedTakeaways.length === 0) {
      setErrorMsg("Please select at least one learning takeaway.");
      return;
    }
    if (comments.trim().length < 3) {
      setErrorMsg(
        "Please provide constructive comments (at least 3 characters)."
      );
      return;
    }

    const toneCheck = validateConstructiveContent(comments.trim());
    if (!toneCheck.isValid) {
      setErrorMsg(
        toneCheck.reason || "Submission text violates community tone standards."
      );
      return;
    }

    const payload = {
      caseStudySlug: slug,
      takeaways: selectedTakeaways,
      comments: comments.trim(),
    };

    setSubmitting(true);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueue({
        type: "feedback",
        endpoint: "/api/case-studies/feedback",
        body: payload,
      });
      setHasSubmittedFeedback(true);
      setSuccessMsg("Thank you! Your learning feedback has been recorded.");
      setSelectedTakeaways([]);
      setComments("");
      setSubmitting(false);
      return;
    }

    const res = await apiClient.post<FeedbackSubmitResponse>(
      "/api/case-studies/feedback",
      payload
    );

    if (res.ok) {
      setHasSubmittedFeedback(true);
      setSuccessMsg(
        res.data?.message ||
          "Thank you! Your learning feedback has been recorded."
      );
      setSelectedTakeaways([]);
      setComments("");
    } else if (res.status >= 400 && res.status < 500) {
      const detailMsg =
        res.details[0]?.message || res.error || "Submission rejected.";
      setErrorMsg(detailMsg);
      setHasSubmittedFeedback(false);
      setSuccessMsg(null);
    } else {
      // Network failure or 5xx: queue for background retry.
      enqueue({
        type: "feedback",
        endpoint: "/api/case-studies/feedback",
        body: payload,
      });
      setHasSubmittedFeedback(true);
      setSuccessMsg("Thank you! Your learning feedback has been recorded.");
      setSelectedTakeaways([]);
      setComments("");
    }
    setSubmitting(false);
  };

  return (
    <section
      aria-label="Article feedback and reactions"
      className="mt-16 w-full border-t border-zinc-900 pt-10 pb-6 min-h-[480px] flex flex-col justify-between transition-all duration-200"
    >
      <div className="space-y-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-900/80 pb-4">
          <div>
            <h3 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
              <IconMessageCode className="w-5 h-5 text-brand-cyan" />
              Learning Feedback & Article Reactions
            </h3>
            <p className="text-xs font-mono text-zinc-400 mt-1">
              Share quick sentiment badges or offer structured post-mortem
              takeaways.
            </p>
          </div>
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest bg-zinc-900/80 px-2.5 py-1 rounded border border-zinc-800/60 self-start sm:self-center">
            Anonymous Rate-Limited
          </span>
        </div>

        {/* 1. Quick Reaction Badges Row */}
        <div className="space-y-3">
          <p className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
            Quick Article Reactions
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {REACTIONS.map(({ type, label, icon: IconComponent }) => {
              const isReacted = userReactions.includes(type);
              const count = counts[type] || 0;
              const isLoading = reactionLoading === type;

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleReactionClick(type)}
                  disabled={isLoading}
                  aria-pressed={isReacted}
                  aria-label={`React with ${label}, current count ${count}`}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-medium border transition-all duration-150 active:scale-95 ${
                    isReacted
                      ? "bg-brand-cyan/15 border-brand-cyan/40 text-brand-cyan shadow-sm shadow-brand-cyan/10"
                      : "bg-zinc-900/70 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-neutral-100 hover:bg-zinc-900"
                  }`}
                >
                  <IconComponent
                    className={`w-4 h-4 ${isReacted ? "text-brand-cyan" : "text-zinc-400"}`}
                  />
                  <span>{label}</span>
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded text-[11px] font-bold ${
                      isReacted
                        ? "bg-brand-cyan/20 text-brand-cyan"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Structured Learning Feedback Form */}
        <div className="space-y-4 pt-2">
          <p className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
            Structured Learning Takeaways
          </p>

          {hasSubmittedFeedback && successMsg ? (
            <div
              role="alert"
              className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-sm flex items-start gap-3 my-2"
            >
              <IconCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold font-sans text-emerald-200">
                  Feedback Submitted!
                </p>
                <p className="text-xs font-mono text-emerald-300/90 mt-1">
                  {successMsg}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitFeedback} className="space-y-5">
              {/* Pre-defined Takeaways Checkboxes / Pills */}
              <div className="flex flex-wrap gap-2">
                {PREDEFINED_TAKEAWAYS.map((takeaway) => {
                  const isSelected = selectedTakeaways.includes(takeaway);
                  return (
                    <button
                      key={takeaway}
                      type="button"
                      onClick={() => toggleTakeaway(takeaway)}
                      aria-pressed={isSelected}
                      className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all duration-150 border active:scale-95 ${
                        isSelected
                          ? "bg-brand-cyan/20 border-brand-cyan/50 text-brand-cyan font-bold"
                          : "bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      {isSelected ? "✓ " : "+ "}
                      {takeaway}
                    </button>
                  );
                })}
              </div>

              {/* Comments Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor={`comments-${slug}`}
                    className="text-xs font-mono text-zinc-400"
                  >
                    Constructive Comments & Key Takeaways
                  </label>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {comments.length} / 2000
                  </span>
                </div>
                <textarea
                  id={`comments-${slug}`}
                  rows={3}
                  value={comments}
                  onChange={(e) => {
                    setErrorMsg(null);
                    setComments(e.target.value.slice(0, 2000));
                  }}
                  placeholder="Describe key insights, questions, or actionable observations from reading this post-mortem..."
                  className="w-full rounded-lg bg-zinc-900/80 border border-zinc-800 p-3 text-sm text-neutral-100 placeholder-zinc-600 focus:outline-none focus:border-brand-cyan/60 focus:ring-1 focus:ring-brand-cyan/30 transition-all font-sans leading-relaxed"
                />
              </div>

              {/* Error Message Display */}
              {errorMsg && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs font-mono flex items-center gap-2"
                >
                  <IconAlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-cyan text-zinc-950 font-mono text-xs font-bold hover:bg-cyan-400 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-md shadow-brand-cyan/20"
                >
                  {submitting ? (
                    <>
                      <IconLoader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <IconSend className="w-4 h-4" />
                      Submit Learning Feedback
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
