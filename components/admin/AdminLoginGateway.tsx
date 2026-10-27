"use client";

import { useState } from "react";
import { SignIn } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { IntentLink } from "@/components/ui/IntentLink";
import {
  IconShieldLock,
  IconTerminal2,
  IconActivity,
  IconArrowLeft,
  IconServer,
  IconLockCheck,
  IconCpu,
  IconFingerprint,
  IconBolt,
  IconCode,
  IconCopy,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
} from "@tabler/icons-react";
import { copyToClipboard } from "@/lib/clipboard";
import { logger } from "@/lib/logger";

interface CopySnippetProps {
  snippetKey: "wizard" | "email";
  text: string;
  label: string;
  copiedKey: string | null;
  onCopy: (key: "wizard" | "email", text: string) => void;
}

function CopySnippet({
  snippetKey,
  text,
  label,
  copiedKey,
  onCopy,
}: CopySnippetProps) {
  const isCopied = copiedKey === snippetKey;
  return (
    <div className="flex items-center justify-between p-2.5 rounded bg-[#13151a] border border-white/10 min-w-0">
      <code className="text-emerald-400 select-all overflow-x-auto whitespace-nowrap text-xs font-mono min-w-0">
        {text}
      </code>
      <button
        type="button"
        onClick={() => onCopy(snippetKey, text)}
        className="shrink-0 ml-2 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] flex items-center gap-1 cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400"
        aria-label={`Copy ${label}`}
      >
        {isCopied ? (
          <IconCheck className="w-3 h-3 text-emerald-400" aria-hidden="true" />
        ) : (
          <IconCopy className="w-3 h-3" aria-hidden="true" />
        )}
        <span>{isCopied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}

export function AdminLoginGateway() {
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);
  const [copiedKey, setCopiedKey] = useState<"wizard" | "email" | null>(null);

  const handleCopy = async (key: "wizard" | "email", text: string) => {
    try {
      await copyToClipboard(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      logger.error("Failed to copy snippet to clipboard:", err);
    }
  };

  return (
    <div
      className="w-full max-w-5xl mx-auto flex flex-col gap-6 py-6"
      data-testid="admin-login-gateway"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Telemetry & Node Observability Console */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Gateway Status Badge */}
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-amber-500/20 bg-amber-500/10 text-amber-400 font-mono text-xs self-start">
            <IconShieldLock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>AUTHOR GATEWAY • V2.4</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-mono flex items-center gap-2.5">
              <IconTerminal2
                className="w-6 h-6 text-amber-500"
                aria-hidden="true"
              />
              <span>Edge Diagnostics</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Administrative gateway for drafting technical case studies,
              inspecting serverless telemetry streams, and validating CDISC data
              models.
            </p>
          </div>

          {/* Telemetry Terminal Card */}
          <div className="p-4 rounded-xl border border-white/10 bg-[#0d0e11] shadow-2xl flex flex-col gap-3 font-mono text-xs">
            {/* Terminal Title Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 text-[11px] text-zinc-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-2 text-zinc-300 font-semibold">
                  gateway-iad1.sys
                </span>
              </div>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            </div>

            {/* Node Specs Matrix */}
            <div className="grid grid-cols-2 gap-2 text-[11px] py-1 border-b border-white/5">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-zinc-400 text-[10px] uppercase flex items-center gap-1">
                  <IconServer
                    className="w-3 h-3 text-zinc-400"
                    aria-hidden="true"
                  />
                  Edge Region
                </span>
                <span className="text-zinc-200 truncate">iad1-us-east</span>
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-zinc-400 text-[10px] uppercase flex items-center gap-1">
                  <IconCpu
                    className="w-3 h-3 text-zinc-400"
                    aria-hidden="true"
                  />
                  Latency / SSR
                </span>
                <span className="text-emerald-400 truncate">
                  0.00ms penalty
                </span>
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-zinc-400 text-[10px] uppercase flex items-center gap-1">
                  <IconLockCheck
                    className="w-3 h-3 text-zinc-400"
                    aria-hidden="true"
                  />
                  Edge Security
                </span>
                <span className="text-zinc-200 truncate">SHA-256 Token</span>
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-zinc-400 text-[10px] uppercase flex items-center gap-1">
                  <IconActivity
                    className="w-3 h-3 text-zinc-400"
                    aria-hidden="true"
                  />
                  Auth Guard
                </span>
                <span className="text-amber-400 truncate">Env Allowlist</span>
              </div>
            </div>

            {/* Rolling Edge Log Feed */}
            <div className="flex flex-col gap-1 text-[10px] text-zinc-400 pt-1">
              <span className="text-zinc-400 font-semibold">
                [EDGE LOG MATRIX]
              </span>
              <div className="p-2 rounded bg-[#13151a] border border-white/5 flex flex-col gap-1 text-[10px]">
                <span className="text-zinc-400">
                  <span className="text-amber-400">› EDGE_INIT</span>{" "}
                  clerkMiddleware chained with HTTP security headers
                </span>
                <span className="text-zinc-400">
                  <span className="text-emerald-400">› ROUTE_GUARD</span> Edge
                  route matcher active on /admin(.*)
                </span>
                <span className="text-zinc-400">
                  <span className="text-zinc-300">› AUTH_GATE</span> Ready for
                  hardware Passkey / OAuth
                </span>
              </div>
            </div>
          </div>

          {/* Navigation & Helper Actions */}
          <div className="flex items-center justify-between pt-1">
            <IntentLink
              href="/case-studies"
              className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <IconArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Return to Case Studies Index</span>
            </IntentLink>

            <button
              type="button"
              onClick={() => setShowConfigDrawer((prev) => !prev)}
              className="inline-flex items-center gap-1 text-xs font-mono text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
              aria-expanded={showConfigDrawer}
            >
              <IconCode className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Environment Setup &amp; Architecture</span>
              {showConfigDrawer ? (
                <IconChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <IconChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Bespoke Clerk Sign-In Surface */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center w-full">
          <div className="w-full max-w-md flex flex-col gap-3">
            <SignIn
              routing="path"
              path="/admin/login"
              signUpUrl={undefined}
              fallbackRedirectUrl="/admin"
              appearance={{
                theme: dark,
                variables: {
                  colorBackground: "#0d0e11",
                  colorPrimary: "#f59e0b",
                  colorNeutral: "#f4f4f6",
                  fontFamily: "var(--font-geist-mono), monospace",
                  borderRadius: "0.5rem",
                },
                elements: {
                  rootBox: "w-full",
                  card: "w-full bg-[#0d0e11] border border-white/10 shadow-2xl rounded-xl p-6 sm:p-7",
                  header: "text-left pb-4 mb-3 border-b border-white/10 gap-1",
                  headerTitle:
                    "text-zinc-100 font-mono text-base font-bold tracking-tight",
                  headerSubtitle: "text-zinc-400 font-sans text-xs",
                  socialButtonsBlockButton:
                    "bg-[#13151a] hover:bg-zinc-800 text-zinc-200 border border-white/10 font-mono text-xs transition-all active:scale-[0.98]",
                  socialButtonsBlockButtonText:
                    "font-mono font-medium text-xs text-zinc-300",
                  dividerLine: "bg-white/10",
                  dividerText:
                    "text-zinc-500 font-mono text-[10px] uppercase tracking-widest bg-[#0d0e11] px-3",
                  formFieldLabel:
                    "text-zinc-400 font-mono text-[11px] uppercase tracking-wider font-medium",
                  formFieldInput:
                    "bg-[#13151a] border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono text-xs rounded-lg transition-colors",
                  formButtonPrimary:
                    "bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono text-xs uppercase tracking-wider font-bold py-2.5 rounded-lg transition-all shadow-md active:scale-[0.98]",
                  footerActionText: "text-zinc-500 font-sans text-xs",
                  footerActionLink:
                    "text-amber-400 hover:text-amber-300 font-mono text-xs font-medium hover:underline",
                  footer: "pt-4 mt-2 border-t border-white/10",
                },
              }}
            />

            {/* Hardware WebAuthn & Edge Micro-Ribbon */}
            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-[#0d0e11] border border-white/10 font-mono text-[10px] text-center">
              <div className="flex flex-col items-center gap-0.5">
                <span className="flex items-center gap-1 text-amber-400 font-medium">
                  <IconFingerprint className="w-3 h-3" aria-hidden="true" />
                  WebAuthn
                </span>
                <span className="text-zinc-400">Passkey Ready</span>
              </div>

              <div className="flex flex-col items-center gap-0.5 border-x border-white/10 px-1">
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <IconCpu className="w-3 h-3" aria-hidden="true" />
                  0ms Penalty
                </span>
                <span className="text-zinc-400">Zero-Prerender</span>
              </div>

              <div className="flex flex-col items-center gap-0.5">
                <span className="flex items-center gap-1 text-cyan-400 font-medium">
                  <IconBolt className="w-3 h-3" aria-hidden="true" />
                  Edge Guard
                </span>
                <span className="text-zinc-400">Rate-Limited</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Architecture & Environment Configuration Drawer */}
      {showConfigDrawer && (
        <div className="w-full p-6 rounded-xl border border-white/10 bg-[#0d0e11] flex flex-col gap-4 font-mono text-xs animate-in fade-in slide-in-from-top-2 duration-200 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2 text-zinc-100 font-bold text-sm">
              <IconCode className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <span>Admin Allowlist &amp; Edge Architecture</span>
            </div>
            <span className="text-[10px] text-zinc-400">
              ADR-0014 Architecture
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Column 1: Setup Wizard & Snippet */}
            <div className="flex flex-col gap-3">
              <div>
                <span className="text-zinc-300 font-semibold text-xs">
                  1. CLI Setup Wizard
                </span>
                <p className="text-zinc-400 text-[11px] font-sans mt-0.5">
                  Run the interactive bash wizard to configure Clerk credentials
                  and admin environment variables.
                </p>
              </div>

              <CopySnippet
                snippetKey="wizard"
                text="npm run setup:clerk"
                label="setup wizard command"
                copiedKey={copiedKey}
                onCopy={handleCopy}
              />

              <div className="flex flex-col gap-1 pt-1">
                <span className="text-zinc-300 font-semibold text-xs">
                  2. Manual Environment Allowlist
                </span>
                <CopySnippet
                  snippetKey="email"
                  text='ADMIN_EMAILS="your-email@example.com"'
                  label="admin email template"
                  copiedKey={copiedKey}
                  onCopy={handleCopy}
                />
              </div>
            </div>

            {/* Column 2: Architectural Invariants */}
            <div className="flex flex-col gap-2 p-3.5 rounded-lg bg-[#13151a] border border-white/5 text-[11px]">
              <span className="text-zinc-200 font-semibold">
                Security &amp; Performance Invariants:
              </span>
              <ul className="flex flex-col gap-1.5 text-zinc-400 font-sans list-disc list-inside">
                <li>
                  <strong className="text-zinc-300 font-mono">
                    Edge Middleware Chaining:
                  </strong>{" "}
                  Composes Clerk auth with WebCrypto SHA-256 telemetry
                  fingerprinting.
                </li>
                <li>
                  <strong className="text-zinc-300 font-mono">
                    Zero SSR Penalty:
                  </strong>{" "}
                  Public portfolio routes bypass auth checks entirely.
                </li>
                <li>
                  <strong className="text-zinc-300 font-mono">
                    Environment-Gated RBAC:
                  </strong>{" "}
                  Server-side authorization against typed allowlists.
                </li>
                <li>
                  <strong className="text-zinc-300 font-mono">
                    CI/CD Offline Stubs:
                  </strong>{" "}
                  Deterministic test execution without live network keys.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
