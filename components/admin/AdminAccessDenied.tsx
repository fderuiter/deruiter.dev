"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { copyToClipboard } from "@/lib/clipboard";
import { logger } from "@/lib/logger";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import {
  IconShieldLock,
  IconCopy,
  IconCheck,
  IconRefresh,
  IconArrowLeft,
  IconUser,
  IconMail,
  IconKey,
  IconAlertTriangle,
} from "@tabler/icons-react";

interface AdminAccessDeniedProps {
  userId: string;
  primaryEmail: string;
  displayName?: string;
}

export function AdminAccessDenied({
  userId,
  primaryEmail,
  displayName = "Author",
}: AdminAccessDeniedProps) {
  const router = useRouter();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { announce } = useAnnouncer();

  const emailSnippet = `ADMIN_EMAILS="${primaryEmail}"`;
  const uidSnippet = `ADMIN_USER_IDS="${userId}"`;

  const handleCopy = async (key: "email" | "uid", text: string) => {
    try {
      await copyToClipboard(text);
      setCopiedKey(key);
      announce("Configuration snippet copied to clipboard", "polite");
      setTimeout(() => setCopiedKey(null), 2500);
    } catch (err) {
      logger.error("Failed to copy configuration snippet:", err);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 1200);
  };

  return (
    <div
      className="w-full max-w-2xl mx-auto flex flex-col gap-6"
      data-testid="admin-access-denied-console"
    >
      {/* Security Status Header */}
      <div className="p-6 rounded-xl border border-amber-500/20 bg-[#13151a] flex flex-col gap-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <IconShieldLock className="w-6 h-6" aria-hidden="true" />
            </span>
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider text-amber-400">
                <IconAlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>403 Forbidden: Unlisted Author Identity</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100 font-mono">
                Access Authorization Required
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <span className="text-xs font-mono text-zinc-400 hidden sm:inline">
              Account:
            </span>
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: "w-8 h-8 border border-white/20",
                },
              }}
            />
          </div>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed">
          You are successfully authenticated with Clerk, but your account is not
          registered in the system&apos;s server-side administrative allowlist (
          <code className="font-mono text-amber-300">ADMIN_EMAILS</code> or{" "}
          <code className="font-mono text-amber-300">ADMIN_USER_IDS</code>).
        </p>

        {/* Authenticated Identity Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-lg bg-[#0d0e11] border border-white/5 font-mono text-xs">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-zinc-500 text-[10px] uppercase tracking-wider flex items-center gap-1">
              <IconUser className="w-3 h-3 text-zinc-400" aria-hidden="true" />
              Identity
            </span>
            <span
              className="text-zinc-200 font-medium truncate"
              title={displayName}
            >
              {displayName}
            </span>
          </div>

          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-zinc-500 text-[10px] uppercase tracking-wider flex items-center gap-1">
              <IconMail className="w-3 h-3 text-zinc-400" aria-hidden="true" />
              Primary Email
            </span>
            <span
              className="text-zinc-200 font-medium truncate"
              title={primaryEmail}
            >
              {primaryEmail}
            </span>
          </div>

          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-zinc-500 text-[10px] uppercase tracking-wider flex items-center gap-1">
              <IconKey className="w-3 h-3 text-zinc-400" aria-hidden="true" />
              Clerk UID
            </span>
            <span className="text-zinc-200 font-medium truncate" title={userId}>
              {userId}
            </span>
          </div>
        </div>
      </div>

      {/* Configuration Helpers Card */}
      <div className="p-6 rounded-xl border border-white/10 bg-[#0d0e11] flex flex-col gap-4 shadow-lg">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100 font-mono">
            Grant Administrator Privileges
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            To authorize this identity, append either your email or Clerk UID to
            your environment configuration (
            <code className="font-mono text-zinc-300">.env.local</code> for
            local development or Vercel Environment Variables for production).
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Email Snippet */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-mono text-zinc-400">
              Option A: Authorize by Email
            </span>
            <div className="flex items-center justify-between gap-2 p-3 rounded bg-zinc-900/90 border border-white/10 font-mono text-xs">
              <code className="text-emerald-400 select-all overflow-x-auto whitespace-nowrap">
                {emailSnippet}
              </code>
              <button
                type="button"
                onClick={() => handleCopy("email", emailSnippet)}
                className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 transition-colors text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-400"
                aria-label="Copy email configuration snippet"
              >
                {copiedKey === "email" ? (
                  <>
                    <IconCheck
                      className="w-3.5 h-3.5 text-emerald-400"
                      aria-hidden="true"
                    />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <IconCopy
                      className="w-3.5 h-3.5 text-zinc-400"
                      aria-hidden="true"
                    />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* UID Snippet */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-mono text-zinc-400">
              Option B: Authorize by Clerk UID
            </span>
            <div className="flex items-center justify-between gap-2 p-3 rounded bg-zinc-900/90 border border-white/10 font-mono text-xs">
              <code className="text-emerald-400 select-all overflow-x-auto whitespace-nowrap">
                {uidSnippet}
              </code>
              <button
                type="button"
                onClick={() => handleCopy("uid", uidSnippet)}
                className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 transition-colors text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-400"
                aria-label="Copy User ID configuration snippet"
              >
                {copiedKey === "uid" ? (
                  <>
                    <IconCheck
                      className="w-3.5 h-3.5 text-emerald-400"
                      aria-hidden="true"
                    />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <IconCopy
                      className="w-3.5 h-3.5 text-zinc-400"
                      aria-hidden="true"
                    />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-white/10">
          <Link
            href="/case-studies"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-white/10 text-xs font-mono transition-colors"
          >
            <IconArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Return to Case Studies</span>
          </Link>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs font-mono transition-colors disabled:opacity-50 cursor-pointer shadow-md"
          >
            <IconRefresh
              className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>
              {isRefreshing
                ? "Checking Permissions..."
                : "Re-verify Authorization"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
