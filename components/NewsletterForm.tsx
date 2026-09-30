"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  IconMail,
  IconSend,
  IconCheck,
  IconAlertCircle,
  IconLoader2,
} from "@tabler/icons-react";
import { useAudio } from "@/components/providers/AudioProvider";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { apiClient } from "@/lib/api-client";

const NEWSLETTER_SUCCESS_MESSAGE = "Almost there: check your inbox to confirm.";

interface NewsletterFormProps {
  className?: string;
  variant?: "compact" | "card";
  onSuccess?: () => void;
}

export function NewsletterForm({
  className = "",
  variant = "compact",
  onSuccess,
}: NewsletterFormProps) {
  const [email, setEmail] = useState("");
  const [gotcha, setGotcha] = useState("");
  const [mountedAt, setMountedAt] = useState<number>(0);
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mountedRef = useRef(false);
  const { playHover } = useAudio();
  const { announce } = useAnnouncer();

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      setMountedAt(Date.now());
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      // The alert below only renders in the "error" state, so the message
      // must be paired with it or it never reaches the reader (#1469).
      setStatus("error");
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setStatus("submitting");

    const res = await apiClient.post("/api/newsletter", {
      email: cleanEmail,
      _gotcha: gotcha,
      _clientTimestamp: mountedAt || Date.now(),
    });

    if (res.networkError) {
      setStatus("error");
      setErrorMessage(
        "Network connection error. Please verify your connection and try again."
      );
      return;
    }

    if (!res.ok) {
      setStatus("error");
      setErrorMessage(
        res.error ||
          `Subscription failed (HTTP ${res.status}). Please try again.`
      );
      return;
    }

    setStatus("success");
    setEmail("");
    // The confirmation banner replaces the form, so a live region on it
    // would be mounted with its text already present and skipped by most
    // screen readers. Announce through the persistent root regions instead.
    announce(NEWSLETTER_SUCCESS_MESSAGE, "polite");
    onSuccess?.();
  };

  return (
    <div
      className={
        variant === "card"
          ? `p-5 sm:p-6 bg-[#13151a]/90 border border-white/10 rounded-2xl shadow-xl ${className}`
          : `w-full ${className}`
      }
    >
      {variant === "card" && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400">
              PROJECT NOTES / NEWSLETTER
            </span>
          </div>
          <h4 className="text-sm font-mono font-bold text-white mb-1">
            Notes from my projects
          </h4>
          <p className="text-xs font-mono text-zinc-400 leading-relaxed">
            Occasional notes on what I’m building, what I’m learning, and the
            bugs that put up a good fight.
          </p>
        </div>
      )}

      {status === "success" ? (
        <div
          data-testid="newsletter-success"
          className="flex items-center gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-mono animate-fade-in"
        >
          <IconCheck className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{NEWSLETTER_SUCCESS_MESSAGE}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          {/* Honeypot anti-spam trap */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="newsletter-company-url">Do not fill this out</label>
            <input
              type="text"
              id="newsletter-company-url"
              name="_gotcha"
              value={gotcha}
              onChange={(e) => setGotcha(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <div className="relative flex-1 min-w-0">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <IconMail className="w-4 h-4" />
              </div>
              <input
                type="email"
                id="newsletter-email-input"
                name="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@domain.com"
                aria-label="Email address for engineering dispatch newsletter"
                disabled={status === "submitting"}
                className="w-full pl-9 pr-3 py-2 bg-zinc-950/80 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-colors disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={status === "submitting"}
              onMouseEnter={() => playHover()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/30 hover:border-brand-cyan/60 rounded-xl text-xs font-mono font-bold text-brand-cyan transition-all duration-200 active:scale-[0.98] disabled:opacity-50 cursor-pointer shrink-0"
            >
              {status === "submitting" ? (
                <>
                  <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Joining...</span>
                </>
              ) : (
                <>
                  <IconSend className="w-3.5 h-3.5" />
                  <span>Subscribe</span>
                </>
              )}
            </button>
          </div>

          {status === "error" && errorMessage && (
            <div
              role="alert"
              className="flex items-center gap-2 pt-1 text-[11px] font-mono text-rose-400"
            >
              <IconAlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
