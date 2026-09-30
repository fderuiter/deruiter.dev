"use client";

import React, { useState, useEffect } from "react";
import {
  IconBulb,
  IconFlame,
  IconTarget,
  IconSearch,
  IconCheck,
  IconAlertCircle,
  IconLoader2,
} from "@tabler/icons-react";
import { apiClient } from "@/lib/api-client";

interface BlogPostReactionsProps {
  slug: string;
}

type ReactionType = "insightful" | "mind_blowing" | "actionable" | "thorough";

interface ReactionsPayload {
  counts?: Record<string, number>;
  userReactions?: unknown;
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

export function BlogPostReactions({ slug }: BlogPostReactionsProps) {
  const [counts, setCounts] = useState<Record<string, number>>({
    insightful: 0,
    mind_blowing: 0,
    actionable: 0,
    thorough: 0,
  });
  const [userReactions, setUserReactions] = useState<string[]>([]);
  const [reactionLoading, setReactionLoading] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadReactions() {
      // Read failures (network, non-2xx, non-JSON) are tolerated silently.
      const { data } = await apiClient.get<ReactionsPayload>(
        `/api/blog/reactions?slug=${encodeURIComponent(slug)}`
      );
      if (data && isMounted) {
        if (data.counts) {
          setCounts(data.counts);
        }
        if (Array.isArray(data.userReactions)) {
          setUserReactions(data.userReactions);
        }
      }
    }

    loadReactions();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const handleReactionClick = async (type: ReactionType) => {
    if (userReactions.includes(type) || reactionLoading) {
      return;
    }

    setReactionLoading(type);
    setStatusMsg(null);

    // Optimistic UI update
    setUserReactions((prev) => [...prev, type]);
    setCounts((prev) => ({
      ...prev,
      [type]: (prev[type] || 0) + 1,
    }));

    const res = await apiClient.post<ReactionsPayload>("/api/blog/reactions", {
      blogPostSlug: slug,
      reactionType: type,
    });
    // A 429 duplicate still carries authoritative counts in its body.
    const payload = (res.body ?? {}) as ReactionsPayload;

    if (res.networkError) {
      setStatusMsg({
        type: "error",
        text: "Network error submitting reaction.",
      });
    } else if (res.status === 429) {
      setStatusMsg({
        type: "error",
        text: res.error || "You have already submitted this reaction.",
      });
      if (payload.counts) {
        setCounts(payload.counts);
      }
      if (Array.isArray(payload.userReactions)) {
        setUserReactions(payload.userReactions);
      }
    } else if (!res.ok) {
      setStatusMsg({
        type: "error",
        text: res.error || "Failed to submit reaction.",
      });
    } else {
      if (payload.counts) {
        setCounts(payload.counts);
      }
      if (Array.isArray(payload.userReactions)) {
        setUserReactions(payload.userReactions);
      }
      setStatusMsg({
        type: "success",
        text: "Reaction recorded! Thank you for reading.",
      });
    }
    setReactionLoading(null);
  };

  return (
    <section
      aria-label="Blog post reactions"
      className="mt-12 mb-8 w-full border-t border-b border-zinc-900/80 py-8"
      data-testid="blog-post-reactions"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h3 className="text-sm font-mono font-bold text-neutral-200 uppercase tracking-wider">
            Reader Reactions
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5 font-sans">
            Signal what resonated in this dispatch.
          </p>
        </div>
        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest bg-zinc-900/60 px-2.5 py-1 rounded border border-zinc-800 self-start sm:self-center">
          Anonymous • Rate-Limited
        </span>
      </div>

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
              disabled={isLoading || isReacted}
              aria-pressed={isReacted}
              aria-label={`React with ${label}, current count ${count}`}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-medium border transition-all duration-150 active:scale-95 ${
                isReacted
                  ? "bg-brand-cyan/15 border-brand-cyan/40 text-brand-cyan shadow-sm shadow-brand-cyan/10 cursor-default"
                  : "bg-zinc-900/70 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-neutral-100 hover:bg-zinc-900 cursor-pointer"
              } focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none`}
            >
              {isLoading ? (
                <IconLoader2 className="w-4 h-4 animate-spin text-brand-cyan" />
              ) : (
                <IconComponent
                  className={`w-4 h-4 ${isReacted ? "text-brand-cyan" : "text-zinc-400"}`}
                />
              )}
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

      {statusMsg && (
        <div
          role="status"
          aria-live="polite"
          className={`mt-4 flex items-center gap-2 text-xs font-mono ${
            statusMsg.type === "success" ? "text-brand-cyan" : "text-red-400"
          }`}
        >
          {statusMsg.type === "success" ? (
            <IconCheck className="w-4 h-4 shrink-0" />
          ) : (
            <IconAlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}
    </section>
  );
}
