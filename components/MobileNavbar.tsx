"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePersona } from "@/components/providers/PersonaProvider";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useResizeObserver } from "@/hooks/useResizeObserver";
import { useFontPreference } from "@/hooks/useFontPreference";
import { useAnnouncer } from "@/components/providers/A11yProvider";
import {
  IconDeviceGamepad2,
  IconShieldCheck,
  IconCpu,
  IconBrain,
  IconFileSpreadsheet,
  IconBriefcase,
  IconFlame,
  IconActivity,
} from "@tabler/icons-react";

export const MobileNavbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { persona, setPersona } = usePersona();
  const { isDyslexic, toggleDyslexiaMode } = useFontPreference();
  const { announce } = useAnnouncer();
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setIsOpen(false);
  }

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
    }
  }, [pathname]);

  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleToggleDyslexia = () => {
    toggleDyslexiaMode();
    announce(
      isDyslexic
        ? "Dyslexia font mode disabled. Using Atkinson Hyperlegible and Lexend."
        : "Dyslexia font mode enabled. Using OpenDyslexic typeface.",
      "polite"
    );
  };

  const handlePersonaSelect = (newPersona: "recruiter" | "technical") => {
    setPersona(newPersona);
    announce(
      newPersona === "technical"
        ? "Switched reading mode to Technical: Deep-dive architecture and engineering details."
        : "Switched reading mode to Recruiter: Executive summary and business impact.",
      "assertive"
    );
  };

  // Scroll detection for backdrop border
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const mobileMenuTrapRef = useFocusTrap<HTMLDivElement>(isOpen, {
    onEscape: () => {
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    returnFocus: true,
  });

  // Body scroll locking when mobile menu is open
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const headerObserverRef = useResizeObserver<HTMLElement>(
    (entry) => {
      const h = Math.round(entry.contentRect.height);
      if (typeof document !== "undefined" && h > 0) {
        const root = document.documentElement.style;
        if (root.getPropertyValue("--header-height") !== `${h}px`) {
          root.setProperty("--header-height", `${h}px`);
          root.setProperty("--navbar-height", `${h}px`);
        }
      }
    },
    { trackVertical: true }
  );

  return (
    <>
      <header
        ref={headerObserverRef}
        className={cn(
          "fixed top-0 inset-x-0 z-50 transition-all duration-300 w-full select-none",
          isScrolled
            ? "bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/60 py-3 shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
            : "bg-transparent py-4"
        )}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex justify-between items-center w-full gap-4">
          {/* Logo / Wordmark */}
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className="group flex min-h-6 items-center gap-2.5 font-mono text-sm tracking-widest font-extrabold text-foreground cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-cyan rounded-md shrink-0"
            aria-label="Frederick de Ruiter Homepage"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-cyan/70 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-cyan"></span>
            </span>
            <span className="tracking-wider">FDERUITER</span>
          </Link>

          {/* Touch Actions Header Bar */}
          <div className="flex items-center gap-2 relative z-50">
            {/* Quick Dyslexia Toggle */}
            <button
              type="button"
              onClick={handleToggleDyslexia}
              aria-pressed={isDyslexic}
              className={cn(
                "flex items-center justify-center min-w-10 min-h-10 px-2.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer",
                isDyslexic
                  ? "border-amber-400/60 bg-amber-400/15 text-amber-300"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-400"
              )}
              aria-label={
                isDyslexic
                  ? "Disable OpenDyslexic font mode"
                  : "Enable OpenDyslexic font mode"
              }
            >
              Aa
            </button>

            {/* Mobile Hamburger Trigger */}
            <button
              ref={triggerRef}
              type="button"
              aria-expanded={isOpen}
              aria-controls="mobile-navigation"
              aria-label={
                isOpen ? "Close navigation menu" : "Open navigation menu"
              }
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center justify-center min-w-11 min-h-11 rounded-xl border border-zinc-800 bg-zinc-900/60 text-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <svg
                className="w-5 h-5 fill-current"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  y="4"
                  width="24"
                  height="2"
                  rx="1"
                  className={cn(
                    "origin-center transition-all duration-300",
                    isOpen ? "rotate-45 translate-y-[6px]" : ""
                  )}
                />
                <rect
                  y="11"
                  width="24"
                  height="2"
                  rx="1"
                  className={cn(
                    "transition-all duration-300",
                    isOpen ? "opacity-0" : ""
                  )}
                />
                <rect
                  y="18"
                  width="24"
                  height="2"
                  rx="1"
                  className={cn(
                    "origin-center transition-all duration-300",
                    isOpen ? "-rotate-45 -translate-y-[8px]" : ""
                  )}
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Touch Mobile Navigation Overlay */}
      <AnimatePresence>
        {isOpen && (
          <div
            ref={mobileMenuTrapRef}
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Touch navigation menu"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsOpen(false);
                if (typeof document !== "undefined") {
                  document.body.style.overflow = "";
                }
              }
            }}
            className="fixed inset-0 z-40 bg-zinc-950/98 backdrop-blur-2xl flex flex-col justify-between pt-[max(5rem,env(safe-area-inset-top)+4rem)] pb-[max(2rem,env(safe-area-inset-bottom)+1.5rem)] px-[max(1.25rem,env(safe-area-inset-left)+1rem)] overflow-y-auto"
          >
            <div className="relative z-10 flex flex-col gap-6">
              {/* Primary Navigation Sections */}
              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold px-1">
                    Primary Navigation
                  </span>
                  <Link
                    href="/case-studies"
                    onClick={() => setIsOpen(false)}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-base font-bold text-neutral-200 flex items-center justify-between active:scale-[0.99] transition-all"
                  >
                    <span>Work &amp; Case Studies</span>
                    <span className="text-xs font-mono text-zinc-500">→</span>
                  </Link>
                  <Link
                    href="/blog"
                    onClick={() => setIsOpen(false)}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-base font-bold text-neutral-200 flex items-center justify-between active:scale-[0.99] transition-all"
                  >
                    <span>Blog</span>
                    <span className="text-xs font-mono text-zinc-500">→</span>
                  </Link>
                  <Link
                    href="/#about"
                    onClick={() => setIsOpen(false)}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-base font-bold text-neutral-200 flex items-center justify-between active:scale-[0.99] transition-all"
                  >
                    <span>About &amp; Experience</span>
                    <span className="text-xs font-mono text-zinc-500">→</span>
                  </Link>
                  <Link
                    href="/contact"
                    onClick={() => setIsOpen(false)}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-base font-bold text-neutral-200 flex items-center justify-between active:scale-[0.99] transition-all"
                  >
                    <span>Contact</span>
                    <span className="text-xs font-mono text-zinc-500">→</span>
                  </Link>
                  <Link
                    href="/schedule"
                    onClick={() => setIsOpen(false)}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-sm font-semibold text-neutral-300 flex items-center justify-between active:scale-[0.99] transition-all"
                  >
                    <span>Office Hours &amp; Schedule</span>
                    <span className="text-xs font-mono text-zinc-500">→</span>
                  </Link>
                </div>

                {/* Systems & Studios */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold px-1">
                    Systems &amp; Interactive Apps
                  </span>
                  <Link
                    href="/crf"
                    onClick={() => setIsOpen(false)}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-sm font-semibold text-neutral-200 flex items-center justify-between gap-2 active:scale-[0.99] transition-all"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <IconFileSpreadsheet className="w-4 h-4 text-brand-cyan shrink-0" />
                      <span className="truncate">CRF Studio &amp; EDC</span>
                    </span>
                    <span className="text-[10px] font-mono text-brand-cyan px-1.5 py-0.5 rounded bg-brand-cyan/10 shrink-0">
                      CDISC
                    </span>
                  </Link>
                  <Link
                    href="/patrol"
                    onClick={() => setIsOpen(false)}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-sm font-semibold text-neutral-200 flex items-center justify-between gap-2 active:scale-[0.99] transition-all"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <IconShieldCheck className="w-4 h-4 text-brand-cyan shrink-0" />
                      <span className="truncate">Patrol Shift</span>
                    </span>
                    <span className="text-[10px] font-mono text-brand-cyan px-1.5 py-0.5 rounded bg-brand-cyan/10 shrink-0">
                      M1
                    </span>
                  </Link>
                  <Link
                    href="/proof"
                    onClick={() => setIsOpen(false)}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-sm font-semibold text-neutral-200 flex items-center justify-between gap-2 active:scale-[0.99] transition-all"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <IconBrain className="w-4 h-4 text-brand-purple shrink-0" />
                      <span className="truncate">Proof Canvas</span>
                    </span>
                    <span className="text-[10px] font-mono text-brand-purple px-1.5 py-0.5 rounded bg-brand-purple/10 shrink-0">
                      AST
                    </span>
                  </Link>
                  <Link
                    href="/stack"
                    onClick={() => setIsOpen(false)}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-sm font-semibold text-neutral-200 flex items-center justify-between gap-2 active:scale-[0.99] transition-all"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <IconCpu className="w-4 h-4 text-brand-cyan shrink-0" />
                      <span className="truncate">Under the Hood (Stack)</span>
                    </span>
                    <span className="text-[10px] font-mono text-brand-cyan px-1.5 py-0.5 rounded bg-brand-cyan/10 shrink-0">
                      Architecture
                    </span>
                  </Link>
                  {persona !== "technical" && (
                    <Link
                      href="/simulator"
                      onClick={() => setIsOpen(false)}
                      className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-sm font-semibold text-neutral-200 flex items-center justify-between gap-2 active:scale-[0.99] transition-all"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <IconActivity className="w-4 h-4 text-brand-cyan shrink-0" />
                        <span className="truncate">Incident Simulator</span>
                      </span>
                      <span className="text-[10px] font-mono text-brand-cyan px-1.5 py-0.5 rounded bg-brand-cyan/10 shrink-0">
                        Outage
                      </span>
                    </Link>
                  )}
                  <Link
                    href="/arcade"
                    onClick={() => setIsOpen(false)}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-base font-bold text-brand-cyan flex items-center justify-between gap-2 active:scale-[0.99] transition-all"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <IconDeviceGamepad2 className="w-4 h-4 shrink-0" />
                      <span className="truncate">Arcade Hub</span>
                    </span>
                    <span className="text-xs font-mono text-brand-cyan shrink-0">
                      6 Games
                    </span>
                  </Link>
                </div>
              </div>

              {/* Mobile Persona Reading Mode Toggle */}
              <div className="border-t border-zinc-900/80 pt-4 flex flex-col gap-2.5">
                <div className="flex flex-col gap-1 px-1">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold">
                    Reading Mode
                  </span>
                </div>
                <div
                  className="flex p-1 bg-zinc-900 border border-zinc-800 rounded-2xl text-xs font-mono w-full select-none"
                  role="group"
                  aria-label="Reading Mode Selection"
                >
                  <button
                    type="button"
                    onClick={() => handlePersonaSelect("technical")}
                    aria-pressed={persona === "technical"}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 min-h-11 py-2.5 rounded-xl font-bold transition-all cursor-pointer",
                      persona === "technical"
                        ? "bg-zinc-950 text-amber-400 border border-amber-400/20"
                        : "text-zinc-400 border border-transparent"
                    )}
                  >
                    <IconFlame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>TECHNICAL</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePersonaSelect("recruiter")}
                    aria-pressed={persona === "recruiter"}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 min-h-11 py-2.5 rounded-xl font-bold transition-all cursor-pointer",
                      persona === "recruiter"
                        ? "bg-zinc-950 text-brand-cyan border border-brand-cyan/20"
                        : "text-zinc-400 border border-transparent"
                    )}
                  >
                    <IconBriefcase className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
                    <span>RECRUITER</span>
                  </button>
                </div>
              </div>

              {/* Mobile Dyslexia Toggle */}
              <div className="border-t border-zinc-900/80 pt-4 flex items-center justify-between">
                <span className="text-xs font-mono font-bold tracking-wider text-zinc-400">
                  DYSLEXIA FONT
                </span>
                <button
                  type="button"
                  onClick={handleToggleDyslexia}
                  aria-pressed={isDyslexic}
                  className={cn(
                    "min-h-11 px-4 py-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer",
                    isDyslexic
                      ? "border-amber-400/50 bg-amber-400/15 text-amber-300"
                      : "border-zinc-800 bg-zinc-900/50 text-zinc-400"
                  )}
                >
                  {isDyslexic ? "OPENDYSLEXIC: ON" : "ENABLE OPENDYSLEXIC"}
                </button>
              </div>
            </div>

            <div className="relative z-10 pt-4 border-t border-zinc-900 flex items-center justify-between text-xs font-mono text-zinc-500">
              <span>© 2026 FREDERICK DE RUITER</span>
              <a
                href="https://github.com/fderuiter/portfolio"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-brand-cyan flex items-center gap-1 min-h-11 px-2 py-2"
              >
                GitHub ↗
              </a>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
