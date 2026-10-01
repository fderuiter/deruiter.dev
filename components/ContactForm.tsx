"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  IconSend,
  IconCheck,
  IconAlertCircle,
  IconLoader2,
  IconMail,
  IconUser,
  IconMessageCode,
  IconTarget,
} from "@tabler/icons-react";
import {
  CONTACT_INTENTS,
  ContactIntent,
  ContactSubmissionSchema,
  toFieldErrors,
} from "@/lib/schemas";
import { logger } from "@/lib/logger";
import { apiClient } from "@/lib/api-client";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { usePersistentState } from "@/hooks/usePersistentState";
import { safeRemoveItem } from "@/lib/safe-storage";

export interface ContactFormDraft {
  name: string;
  email: string;
  intent: ContactIntent;
  subject: string;
  message: string;
}

export const CONTACT_FORM_DRAFT_KEY = "portfolio_contact_form_draft";

interface ContactFormProps {
  initialIntent?: ContactIntent;
  initialSubject?: string;
  initialMessage?: string;
  className?: string;
  onSuccess?: () => void;
}

export function ContactForm({
  initialIntent = "general",
  initialSubject = "",
  initialMessage = "",
  className = "",
  onSuccess,
}: ContactFormProps) {
  const defaultDraft: ContactFormDraft = useMemo(
    () => ({
      name: "",
      email: "",
      intent: initialIntent,
      subject: initialSubject,
      message: initialMessage,
    }),
    [initialIntent, initialSubject, initialMessage]
  );

  const [draft, setDraft] = usePersistentState<ContactFormDraft>(
    CONTACT_FORM_DRAFT_KEY,
    defaultDraft
  );

  const name = draft?.name ?? "";
  const email = draft?.email ?? "";
  const intent = draft?.intent ?? initialIntent;
  const subject = draft?.subject ?? initialSubject;
  const message = draft?.message ?? initialMessage;

  const setName = (val: string) =>
    setDraft((prev) => ({ ...(prev || defaultDraft), name: val }));
  const setEmail = (val: string) =>
    setDraft((prev) => ({ ...(prev || defaultDraft), email: val }));
  const setIntent = (val: ContactIntent) =>
    setDraft((prev) => ({ ...(prev || defaultDraft), intent: val }));
  const setSubject = (val: string) =>
    setDraft((prev) => ({ ...(prev || defaultDraft), subject: val }));
  const setMessage = (val: string) =>
    setDraft((prev) => ({ ...(prev || defaultDraft), message: val }));

  const [gotcha, setGotcha] = useState(""); // Honeypot field

  const [mountedAt, setMountedAt] = useState<number>(0);
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mountedRef = useRef(false);
  const { announce } = useAnnouncer();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      setMountedAt(Date.now());
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate against the same contract /api/contact enforces, so bounds,
    // email format and tone checks fail here instead of after a roundtrip.
    const parsed = ContactSubmissionSchema.safeParse({
      name,
      email,
      intent,
      subject,
      message,
      _gotcha: gotcha,
      _clientTimestamp: mountedAt || Date.now(),
    });
    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
      // Move focus to the first invalid field (in visual/DOM order) so
      // keyboard and screen-reader users are told a submission failed and
      // where to fix it, instead of focus silently staying on the submit
      // button with no announcement.
      const firstInvalidRef = errors.name
        ? nameInputRef
        : errors.email
          ? emailInputRef
          : errors.subject
            ? subjectInputRef
            : errors.message
              ? messageInputRef
              : null;
      if (firstInvalidRef) {
        firstInvalidRef.current?.focus();
      } else {
        // An issue on a field with no input (none today) must still be
        // shown, or the submit would fail with no feedback at all.
        setStatus("error");
        setErrorMessage(parsed.error.issues[0]?.message ?? null);
      }
      return;
    }

    setFieldErrors({});
    setStatus("submitting");

    const res = await apiClient.post("/api/contact", parsed.data);

    if (res.networkError) {
      logger.error("Contact submission error: network request failed");
      setStatus("error");
      setErrorMessage(
        "Network connection error. Please check your connection or email directly to fpderuiter@gmail.com."
      );
      return;
    }

    if (!res.ok) {
      setStatus("error");
      setErrorMessage(
        res.error ||
          `Unable to send message (HTTP ${res.status}). Please try again later or email directly.`
      );
      return;
    }

    setStatus("success");
    safeRemoveItem(CONTACT_FORM_DRAFT_KEY);
    // The success card replaces the form, so a live region on it would be
    // mounted with its text already present and skipped by most screen
    // readers. Announce through the persistent root regions instead.
    announce(
      `Message sent! Thanks for reaching out, ${name || "friend"}. Your message is in my inbox. I’ll get back to you by email.`,
      "polite"
    );
    onSuccess?.();
  };

  const handleReset = () => {
    safeRemoveItem(CONTACT_FORM_DRAFT_KEY);
    setGotcha("");
    setStatus("idle");
    setErrorMessage(null);
    setFieldErrors({});
    setMountedAt(Date.now());
  };

  if (status === "success") {
    return (
      <div
        className={`p-6 sm:p-8 rounded-2xl bg-[#13151a] border border-emerald-500/30 text-center flex flex-col items-center justify-center shadow-xl ${className}`}
        data-testid="contact-form-success"
      >
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <IconCheck className="w-7 h-7" />
        </div>
        <h3 className="text-lg sm:text-xl font-mono font-bold text-white mb-2">
          Message sent!
        </h3>
        <p className="text-xs sm:text-sm text-zinc-300 font-sans max-w-md mb-6 leading-relaxed">
          Thanks for reaching out,{" "}
          <span className="font-bold text-white">{name || "friend"}</span>. Your
          message is in my inbox. I’ll get back to you by email.
        </p>
        <button
          type="button"
          onClick={handleReset}
          className="px-5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-mono font-bold text-zinc-200 hover:text-white hover:border-amber-400/50 hover:bg-zinc-800 transition-all cursor-pointer active:scale-95"
        >
          Send Another Message &rarr;
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={`p-6 sm:p-8 rounded-2xl bg-[#13151a] border border-white/10 shadow-xl flex flex-col gap-5 ${className}`}
      aria-label="Direct contact inquiry form"
    >
      {/* Invisible Honeypot Trap for Bots */}
      <div
        className="sr-only opacity-0 absolute -left-[9999px] select-none"
        aria-hidden="true"
      >
        <label htmlFor="company_honeypot">Leave this blank</label>
        <input
          id="company_honeypot"
          type="text"
          name="company_url"
          value={gotcha}
          onChange={(e) => setGotcha(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Error Banner */}
      {status === "error" && errorMessage && (
        <div
          className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs font-mono flex items-start gap-3"
          role="alert"
        >
          <IconAlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block mb-0.5">
              Couldn’t send your message:
            </span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Top Row: Name & Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="contact_name"
            className="text-xs font-mono font-bold text-zinc-300 flex items-center gap-1.5"
          >
            <IconUser className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Your Name <span className="text-amber-400">*</span>
            </span>
          </label>
          <input
            id="contact_name"
            name="name"
            type="text"
            required
            ref={nameInputRef}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name)
                setFieldErrors((prev) => ({ ...prev, name: "" }));
            }}
            placeholder="e.g. Ada Lovelace"
            aria-invalid={!!fieldErrors.name}
            aria-describedby={fieldErrors.name ? "name_error" : undefined}
            className={`w-full px-3.5 py-2.5 rounded-xl bg-[#0d0e11] border text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 transition-all ${
              fieldErrors.name
                ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/30"
                : "border-white/10 focus:border-amber-400/60 focus:ring-amber-400/20"
            }`}
          />
          {fieldErrors.name && (
            <span
              id="name_error"
              className="text-[11px] font-mono text-red-400"
            >
              {fieldErrors.name}
            </span>
          )}
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="contact_email"
            className="text-xs font-mono font-bold text-zinc-300 flex items-center gap-1.5"
          >
            <IconMail className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Email Address <span className="text-amber-400">*</span>
            </span>
          </label>
          <input
            id="contact_email"
            name="email"
            type="email"
            required
            ref={emailInputRef}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email)
                setFieldErrors((prev) => ({ ...prev, email: "" }));
            }}
            placeholder="e.g. ada@example.com"
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? "email_error" : undefined}
            className={`w-full px-3.5 py-2.5 rounded-xl bg-[#0d0e11] border text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 transition-all ${
              fieldErrors.email
                ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/30"
                : "border-white/10 focus:border-amber-400/60 focus:ring-amber-400/20"
            }`}
          />
          {fieldErrors.email && (
            <span
              id="email_error"
              className="text-[11px] font-mono text-red-400"
            >
              {fieldErrors.email}
            </span>
          )}
        </div>
      </div>

      {/* Intent Selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-mono font-bold text-zinc-300 flex items-center gap-1.5">
          <IconTarget className="w-3.5 h-3.5 text-amber-400" />
          <span>What’s this about?</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {CONTACT_INTENTS.map((item) => {
            const isSelected = intent === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setIntent(item)}
                className={`flex-1 min-w-[100px] px-3 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all border text-center cursor-pointer min-h-[40px] flex items-center justify-center ${
                  isSelected
                    ? "bg-amber-500/15 border-amber-400/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                    : "bg-[#0d0e11] border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {/* Subject */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="contact_subject"
          className="text-xs font-mono font-bold text-zinc-300 flex items-center gap-1.5"
        >
          <IconMessageCode className="w-3.5 h-3.5 text-amber-400" />
          <span>
            Subject <span className="text-amber-400">*</span>
          </span>
        </label>
        <input
          id="contact_subject"
          name="subject"
          type="text"
          required
          ref={subjectInputRef}
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            if (fieldErrors.subject)
              setFieldErrors((prev) => ({ ...prev, subject: "" }));
          }}
          placeholder="e.g. A project I’d like your help with"
          aria-invalid={!!fieldErrors.subject}
          aria-describedby={fieldErrors.subject ? "subject_error" : undefined}
          className={`w-full px-3.5 py-2.5 rounded-xl bg-[#0d0e11] border text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 transition-all ${
            fieldErrors.subject
              ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/30"
              : "border-white/10 focus:border-amber-400/60 focus:ring-amber-400/20"
          }`}
        />
        {fieldErrors.subject && (
          <span
            id="subject_error"
            className="text-[11px] font-mono text-red-400"
          >
            {fieldErrors.subject}
          </span>
        )}
      </div>

      {/* Message */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="contact_message"
          className="text-xs font-mono font-bold text-zinc-300 flex items-center justify-between"
        >
          <span className="flex items-center gap-1.5">
            <IconMessageCode className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Message <span className="text-amber-400">*</span>
            </span>
          </span>
          <span className="text-[10px] font-normal text-zinc-400">
            {message.length} / 5000 chars
          </span>
        </label>
        <textarea
          id="contact_message"
          name="message"
          required
          rows={4}
          ref={messageInputRef}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (fieldErrors.message)
              setFieldErrors((prev) => ({ ...prev, message: "" }));
          }}
          placeholder="Write your note, idea, project outline, or question here..."
          aria-invalid={!!fieldErrors.message}
          aria-describedby={fieldErrors.message ? "message_error" : undefined}
          className={`w-full px-3.5 py-2.5 rounded-xl bg-[#0d0e11] border text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 transition-all resize-y min-h-[100px] leading-relaxed ${
            fieldErrors.message
              ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/30"
              : "border-white/10 focus:border-amber-400/60 focus:ring-amber-400/20"
          }`}
        />
        {fieldErrors.message && (
          <span
            id="message_error"
            className="text-[11px] font-mono text-red-400"
          >
            {fieldErrors.message}
          </span>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-white/5">
        <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Please don’t include passwords or patient information.</span>
        </span>

        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-400 text-zinc-950 font-mono font-bold text-xs hover:bg-amber-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-[0_0_20px_rgba(245,158,11,0.25)] cursor-pointer"
        >
          {status === "submitting" ? (
            <>
              <IconLoader2 className="w-4 h-4 animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <IconSend className="w-4 h-4" />
              <span>Send Message</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
