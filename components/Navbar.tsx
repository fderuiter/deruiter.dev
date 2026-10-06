"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { isModifiedClick, scrollToElement } from "@/lib/scroll";
import { useAudio } from "@/components/providers/AudioProvider";
import { useSearch } from "@/components/providers/SearchProvider";
import { usePersona } from "@/components/providers/PersonaProvider";
import { isNavGroupActive, isNavMenu, PRIMARY_NAV } from "@/lib/navigation";
import { DesktopNavMenu } from "@/components/nav/DesktopNavMenu";
import { MobileNavSections } from "@/components/nav/MobileNavSections";
import { PERSONA_ANNOUNCEMENTS, type PersonaType } from "@/lib/persona";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useResizeObserver } from "@/hooks/useResizeObserver";
import { useFontPreference } from "@/hooks/useFontPreference";
import { useAnnouncer } from "@/components/providers/A11yProvider";
import {
  IconVolume,
  IconVolumeOff,
  IconChevronDown,
  IconSearch,
  IconBriefcase,
  IconFlame,
} from "@tabler/icons-react";

export const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const { volume, muted, profile, setVolume, setMuted, setProfile, playHover } =
    useAudio();
  const { openSearch } = useSearch();
  const { persona, setPersona } = usePersona();
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const { isDyslexic, toggleDyslexiaMode } = useFontPreference();
  const { announce } = useAnnouncer();

  const handleToggleDyslexia = () => {
    toggleDyslexiaMode();
    announce(
      isDyslexic
        ? "Dyslexia font mode disabled. Using Atkinson Hyperlegible and Lexend."
        : "Dyslexia font mode enabled. Using OpenDyslexic typeface.",
      "polite"
    );
  };

  const handlePersonaSelect = (newPersona: PersonaType) => {
    setPersona(newPersona);
    announce(PERSONA_ANNOUNCEMENTS[newPersona], "assertive");
  };

  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setIsOpen(false);
    setActiveDropdown(null);
    setShowAudioPanel(false);
    setShowPreferences(false);
  }

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
    }
  }, [pathname]);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const preferencesTriggerRef = useRef<HTMLButtonElement>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);

  const handleLinkHover = (e: React.MouseEvent<HTMLElement>) => {
    if (typeof window === "undefined") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pan = ((rect.left + rect.width / 2) / window.innerWidth) * 2 - 1;
    playHover(pan);
  };

  // 1. Scroll-driven backdrop color transition
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

  // 2. Scroll Spy: active section observer
  useEffect(() => {
    if (pathname !== "/" || typeof IntersectionObserver === "undefined") return;

    const sections = ["hero", "case-studies", "about", "contact"];

    const callback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(callback, {
      rootMargin: "-25% 0px -55% 0px",
      threshold: 0.1,
    });

    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [pathname]);

  // 3. Click outside dropdown handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        navContainerRef.current &&
        !navContainerRef.current.contains(e.target as Node)
      ) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  // A section picked from the mobile drawer is scrolled to once the drawer has
  // closed. Closing the drawer releases its focus trap, which queues a focus
  // restoration to the hamburger trigger; this timer is queued after it (all
  // effect cleanups in a commit run before any effect setup), so focus lands
  // on the section rather than being pulled back to the trigger.
  const pendingAnchorRef = useRef<string | null>(null);
  useEffect(() => {
    if (isOpen) return;
    const targetId = pendingAnchorRef.current;
    if (!targetId) return;
    pendingAnchorRef.current = null;
    const timer = setTimeout(() => scrollToElement(targetId), 0);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Accessibility: Esc key listener for desktop disclosures and audio panel.
  // Escape must still close a panel while focus is on one of its controls, so
  // it is allowed in inputs. It listens on document so it runs before the
  // window-level focus trap listeners.
  useHotkeys(
    "Escape",
    () => {
      if (showPreferences) {
        setShowPreferences(false);
        preferencesTriggerRef.current?.focus();
      } else if (showAudioPanel) {
        setShowAudioPanel(false);
      } else if (activeDropdown) {
        const trigger = menuTriggerRefs.current[activeDropdown];
        setActiveDropdown(null);
        trigger?.focus();
      }
    },
    {
      enabled: Boolean(activeDropdown || showAudioPanel || showPreferences),
      allowInInputs: true,
      allowInKeyboardBoundary: true,
      target: "document",
    }
  );

  // Handle smooth scroll clicks on homepage and universal mobile drawer dismissal
  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    setActiveDropdown(null);
    setIsOpen(false);
    setShowPreferences(false);
    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
    }
    // Off the homepage, or with a modifier key (open in a new tab), the link
    // navigates as usual.
    if (pathname !== "/" || !href.startsWith("/#") || isModifiedClick(e)) {
      return;
    }
    e.preventDefault();
    const targetId = href.substring(2);
    if (!document.getElementById(targetId)) return;
    setActiveSection(targetId);
    if (isOpen) {
      pendingAnchorRef.current = targetId;
    } else {
      scrollToElement(targetId);
    }
  };

  const headerObserverRef = useResizeObserver<HTMLElement>(
    (entry) => {
      const h = Math.round(entry.contentRect.height);
      if (typeof document !== "undefined" && h > 0) {
        // Skip the :root write when the value is unchanged, so hydration does
        // not invalidate styles page-wide for nothing (ADR 0052, #817). The
        // comparison is against the current inline value, not the CSS
        // default, so a return to a previous height is never dropped.
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
      {/* Navbar Container */}
      <header
        ref={headerObserverRef}
        className={cn(
          "fixed top-0 inset-x-0 z-50 transition-all duration-300 w-full select-none",
          isScrolled
            ? "bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-800/60 py-3 shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
            : "bg-transparent py-5"
        )}
      >
        <div
          ref={navContainerRef}
          className="@container max-w-6xl 2xl:max-w-[85rem] mx-auto px-4 sm:px-6 md:px-10 flex flex-wrap justify-between items-center w-full gap-4 sm:gap-6 lg:gap-8"
        >
          {/* Logo / Wordmark */}
          <Link
            href="/"
            onClick={(e) => handleNavClick(e, "/#hero")}
            onMouseEnter={handleLinkHover}
            className="group flex min-h-6 items-center gap-2.5 font-mono text-sm tracking-widest font-extrabold text-foreground cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-cyan rounded-md shrink-0"
            aria-label="Frederick de Ruiter Homepage"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping-settle absolute inline-flex h-full w-full rounded-full bg-brand-cyan/70 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-cyan"></span>
            </span>
            <span className="tracking-wider">FDERUITER</span>
          </Link>

          {/* Desktop Navigation Links. Media queries ignore the page's root
              font size, so at 200% text a 1440px viewport still matches xl
              while the group needs twice the room (#1643). The group therefore
              also requires enough header row to sit beside the wordmark on one
              row, measured in the root font size by the container query;
              otherwise the mobile bar below takes over. The logo plus the row
              gap take about 8.25rem. From xl to 2xl the row is 67rem at 100%
              text and the xl group about 54.6rem, so 66rem leaves room. At 2xl
              the row widens to 80rem (#1659) because the 2xl group is about
              65.6rem and grows to about 69.8rem with the dyslexia and sound
              labels on, so it needs 78rem. */}
          <div
            data-testid="navbar-desktop-group"
            className="hidden xl:max-2xl:@min-[66rem]:flex 2xl:@min-[78rem]:flex items-center gap-2.5 lg:gap-3.5 2xl:gap-5 shrink-0"
          >
            <nav
              className="flex items-center gap-2.5 md:gap-3.5 lg:gap-4.5 shrink-0"
              aria-label="Main Navigation"
            >
              {PRIMARY_NAV.map((group) => {
                if (isNavMenu(group)) {
                  return (
                    <DesktopNavMenu
                      key={group.id}
                      group={group}
                      isCurrent={
                        isNavGroupActive(group, pathname) ||
                        (group.id === "about" &&
                          pathname === "/" &&
                          activeSection === "about")
                      }
                      isOpen={activeDropdown === group.id}
                      pathname={pathname}
                      persona={persona}
                      onToggle={() => {
                        setShowPreferences(false);
                        setActiveDropdown(
                          activeDropdown === group.id ? null : group.id
                        );
                      }}
                      onNavigate={handleNavClick}
                      onLinkHover={handleLinkHover}
                      triggerRef={(node) => {
                        menuTriggerRefs.current[group.id] = node;
                      }}
                    />
                  );
                }
                const isCurrent =
                  isNavGroupActive(group, pathname) ||
                  (group.id === "contact" &&
                    pathname === "/" &&
                    activeSection === "contact");
                const onHome = group.id === "contact" && pathname === "/";
                return (
                  <Link
                    key={group.id}
                    href={onHome ? "/#contact" : group.href}
                    aria-current={isCurrent ? "page" : undefined}
                    onClick={(e) => {
                      if (onHome) {
                        handleNavClick(e, "/#contact");
                      } else {
                        setActiveDropdown(null);
                      }
                    }}
                    onMouseEnter={handleLinkHover}
                    className={cn(
                      "py-1 text-xs font-mono tracking-wider font-semibold transition-all duration-200 hover:text-foreground cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0",
                      isCurrent ? "text-brand-cyan font-bold" : "text-muted"
                    )}
                  >
                    {group.label}
                  </Link>
                );
              })}
            </nav>

            {/* Quick-Access ⌘K Command Palette Trigger Button */}
            <button
              type="button"
              onClick={openSearch}
              onMouseEnter={handleLinkHover}
              className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:border-brand-cyan/40 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 shrink-0 whitespace-nowrap"
              aria-label="Search portfolio and commands (Press Command+K)"
            >
              <IconSearch className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="text-xs font-mono hidden lg:inline">Search</span>
              <kbd className="kbd-badge text-[10px] text-zinc-400 font-mono">
                ⌘K
              </kbd>
            </button>

            {/* Global Persona Toggle (Desktop) */}
            <div
              className="hidden xl:flex p-0.5 bg-zinc-900/85 border border-zinc-800/80 rounded-xl text-[10px] font-mono shrink-0 select-none"
              role="group"
              aria-label="Reading Mode Selection"
            >
              <button
                type="button"
                onClick={() => handlePersonaSelect("behind-the-scenes")}
                aria-pressed={persona === "behind-the-scenes"}
                aria-label="Switch to Behind the Scenes Mode: Candid reality and engineering stories"
                title="Behind the Scenes Mode: Candid reality and engineering stories"
                className={cn(
                  "flex items-center justify-center gap-1 px-2 md:px-2.5 py-1.5 rounded-lg font-bold transition-all duration-200 cursor-pointer min-h-8 shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-950",
                  persona === "behind-the-scenes"
                    ? "bg-zinc-950 text-amber-400 border border-amber-400/20 shadow-[0_0_8px_rgba(251,191,36,0.15)]"
                    : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                )}
              >
                <IconFlame className="w-3.5 h-3.5 shrink-0" />
                <span>STORY</span>
              </button>
              <button
                type="button"
                onClick={() => handlePersonaSelect("professional")}
                aria-pressed={persona === "professional"}
                aria-label="Switch to Professional Mode: Concise overview of technical responsibilities and systems impact"
                title="Professional Mode: Concise overview of technical responsibilities and systems impact"
                className={cn(
                  "flex items-center justify-center gap-1 px-2 md:px-2.5 py-1.5 rounded-lg font-bold transition-all duration-200 cursor-pointer min-h-8 shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-950",
                  persona === "professional"
                    ? "bg-zinc-950 text-brand-cyan border border-brand-cyan/20 shadow-[0_0_8px_rgba(6,182,212,0.15)]"
                    : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                )}
              >
                <IconBriefcase className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden 2xl:inline">PROFESSIONAL</span>
                <span className="hidden xl:inline 2xl:hidden">PRO</span>
              </button>
            </div>

            {/* Dyslexia Mode Toggle Pill Desktop */}
            <div className="relative hidden xl:block shrink-0">
              <button
                type="button"
                onClick={handleToggleDyslexia}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-full border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400/50 shrink-0 whitespace-nowrap text-xs font-mono font-bold",
                  isDyslexic
                    ? "border-amber-400/60 bg-amber-400/15 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                    : "border-zinc-900 bg-zinc-900/40 hover:border-zinc-700 text-zinc-400 hover:text-foreground"
                )}
                aria-label={
                  isDyslexic
                    ? "Disable OpenDyslexic font mode"
                    : "Enable OpenDyslexic font mode"
                }
                aria-pressed={isDyslexic}
                title={
                  isDyslexic
                    ? "OpenDyslexic active - click to reset"
                    : "Switch to OpenDyslexic typeface"
                }
              >
                <span className="font-bold text-xs" aria-hidden="true">
                  Aa
                </span>
                <span className="text-[10px] tracking-wider hidden 2xl:inline">
                  {isDyslexic ? "OPENDYSLEXIC" : "DYSLEXIA"}
                </span>
              </button>
            </div>

            {/* Audio Controller Desktop */}
            <div className="relative hidden 2xl:block shrink-0">
              <button
                type="button"
                onClick={() => setShowAudioPanel(!showAudioPanel)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-full border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 shrink-0 whitespace-nowrap",
                  !muted
                    ? "border-brand-cyan/40 bg-brand-cyan/5 text-brand-cyan shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                    : "border-zinc-900 bg-zinc-900/40 hover:border-brand-cyan/40 text-zinc-400 hover:text-foreground"
                )}
                aria-label="Sound Settings"
                aria-expanded={showAudioPanel}
              >
                {muted ? (
                  <IconVolumeOff className="w-3.5 h-3.5 text-zinc-500" />
                ) : (
                  <div className="flex items-center gap-0.5" aria-hidden="true">
                    <span className="w-0.5 h-2.5 bg-brand-cyan rounded-full animate-[pulse_1s_ease-in-out_infinite]" />
                    <span className="w-0.5 h-3.5 bg-brand-cyan rounded-full animate-[pulse_1.4s_ease-in-out_infinite]" />
                    <span className="w-0.5 h-2 bg-brand-cyan rounded-full animate-[pulse_0.8s_ease-in-out_infinite]" />
                  </div>
                )}
                <span className="text-[10px] font-mono tracking-wider font-bold">
                  {muted ? "MUTED" : profile.toUpperCase()}
                </span>
                <IconChevronDown className="w-3 h-3 text-zinc-500" />
              </button>

              <AnimatePresence>
                {showAudioPanel && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowAudioPanel(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-64 p-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_25px_rgba(6,182,212,0.08)] z-50 flex flex-col gap-3.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold tracking-wider text-zinc-400">
                          SYNTH SETTINGS
                        </span>
                        <button
                          type="button"
                          onClick={() => setMuted(!muted)}
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-black border border-zinc-900 bg-zinc-900/50 hover:border-brand-cyan/40 text-brand-cyan transition-all cursor-pointer"
                        >
                          {muted ? "UNMUTE" : "MUTE"}
                        </button>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                          <span>Volume</span>
                          <span>{Math.round(volume * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          aria-label="Volume"
                          min="0"
                          max="100"
                          value={Math.round(volume * 100)}
                          onChange={(e) =>
                            setVolume(parseFloat(e.target.value) / 100)
                          }
                          disabled={muted}
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-brand-cyan disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-mono text-zinc-500">
                          Sound Profile
                        </span>
                        <div className="flex flex-col gap-1.5">
                          {(["8-bit", "90s-retro", "ambient"] as const).map(
                            (p) => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setProfile(p)}
                                disabled={muted}
                                className={cn(
                                  "w-full text-left px-3 py-1.5 rounded-lg border text-[10px] font-mono tracking-wider transition-all duration-200 cursor-pointer active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed",
                                  profile === p
                                    ? "bg-brand-cyan/10 border-brand-cyan/40 text-brand-cyan font-bold shadow-[0_0_12px_rgba(6,182,212,0.12)]"
                                    : "bg-zinc-900/20 border-zinc-900 hover:border-zinc-800 text-zinc-400 hover:text-foreground"
                                )}
                              >
                                {p === "8-bit"
                                  ? "8-Bit Retro"
                                  : p === "90s-retro"
                                    ? "90s Retro"
                                    : "Ambient Pad"}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="relative hidden xl:block 2xl:hidden shrink-0">
              <button
                ref={preferencesTriggerRef}
                type="button"
                aria-label="Open navigation preferences"
                aria-controls="navigation-preferences"
                aria-expanded={showPreferences}
                onClick={() => {
                  setActiveDropdown(null);
                  setShowPreferences((isVisible) => !isVisible);
                }}
                className="flex min-h-9 items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-mono text-zinc-300 transition-colors hover:border-brand-cyan/40 hover:text-white focus-visible:ring-2 focus-visible:ring-brand-cyan/40"
              >
                {muted ? (
                  <IconVolumeOff className="h-3.5 w-3.5" />
                ) : (
                  <IconVolume className="h-3.5 w-3.5 text-brand-cyan" />
                )}
                <span>Preferences</span>
                <IconChevronDown
                  className={cn(
                    "h-3 w-3 text-zinc-500 transition-transform",
                    showPreferences && "rotate-180"
                  )}
                />
              </button>

              {showPreferences && (
                <>
                  <button
                    type="button"
                    aria-label="Close navigation preferences"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setShowPreferences(false)}
                  />
                  <div
                    id="navigation-preferences"
                    className="absolute right-0 z-50 mt-2 flex w-72 flex-col gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
                  >
                    <div>
                      <p className="text-[11px] font-mono font-bold tracking-wider text-zinc-300">
                        PREFERENCES
                      </p>
                      <p
                        id="reading-mode-help"
                        className="mt-1 text-[10px] font-sans text-zinc-400 leading-normal"
                      >
                        {persona === "behind-the-scenes"
                          ? "Behind the Scenes Mode: The candid version, with the engineering stories left in."
                          : "Professional Mode: A concise overview of responsibilities and systems impact."}
                      </p>
                    </div>
                    <div
                      className="flex rounded-xl border border-zinc-800 bg-zinc-900/85 p-0.5 text-[10px] font-mono"
                      role="group"
                      aria-label="Reading Mode Selection"
                      aria-describedby="reading-mode-help"
                    >
                      <button
                        type="button"
                        onClick={() => handlePersonaSelect("behind-the-scenes")}
                        aria-pressed={persona === "behind-the-scenes"}
                        className={cn(
                          "min-h-9 flex-1 rounded-lg px-2 font-bold flex items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
                          persona === "behind-the-scenes"
                            ? "bg-zinc-950 text-amber-400"
                            : "text-zinc-500 hover:text-zinc-300"
                        )}
                        aria-label="Switch to Behind the Scenes Mode: Candid reality and engineering stories"
                        title="Behind the Scenes Mode: Candid reality and engineering stories"
                      >
                        <IconFlame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>STORY</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePersonaSelect("professional")}
                        aria-pressed={persona === "professional"}
                        className={cn(
                          "min-h-9 flex-1 rounded-lg px-2 font-bold flex items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
                          persona === "professional"
                            ? "bg-zinc-950 text-brand-cyan"
                            : "text-zinc-500 hover:text-zinc-300"
                        )}
                        aria-label="Switch to Professional Mode: Concise overview of technical responsibilities and systems impact"
                        title="Professional Mode: Concise overview of technical responsibilities and systems impact"
                      >
                        <IconBriefcase className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
                        <span>PROFESSIONAL</span>
                      </button>
                    </div>
                    <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                        <span>Sound · {muted ? "off" : profile}</span>
                        <button
                          type="button"
                          onClick={() => setMuted(!muted)}
                          className="min-h-8 rounded-lg border border-zinc-800 px-2 text-brand-cyan hover:border-brand-cyan/40"
                        >
                          {muted ? "Unmute" : "Mute"}
                        </button>
                      </div>
                      <input
                        aria-label="Volume"
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(volume * 100)}
                        onChange={(e) =>
                          setVolume(parseFloat(e.target.value) / 100)
                        }
                        disabled={muted}
                        className="w-full accent-brand-cyan disabled:opacity-40"
                      />
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["8-bit", "90s-retro", "ambient"] as const).map(
                          (soundProfile) => (
                            <button
                              key={soundProfile}
                              type="button"
                              disabled={muted}
                              onClick={() => setProfile(soundProfile)}
                              className={cn(
                                "min-h-8 rounded-lg border px-1 text-[10px] font-mono disabled:opacity-40",
                                profile === soundProfile
                                  ? "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan"
                                  : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
                              )}
                            >
                              {soundProfile === "8-bit"
                                ? "8-Bit"
                                : soundProfile === "90s-retro"
                                  ? "90s"
                                  : "Ambient"}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-900">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono font-bold text-zinc-300">
                          Dyslexia Font
                        </span>
                        <span className="text-[9px] font-mono text-zinc-500">
                          OpenDyslexic mode
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleDyslexia}
                        aria-pressed={isDyslexic}
                        aria-label={
                          isDyslexic
                            ? "Disable OpenDyslexic font mode"
                            : "Enable OpenDyslexic font mode"
                        }
                        className={cn(
                          "min-h-8 px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold transition-all cursor-pointer",
                          isDyslexic
                            ? "border-amber-400/50 bg-amber-400/15 text-amber-300"
                            : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white hover:border-zinc-700"
                        )}
                      >
                        {isDyslexic ? "ON" : "OFF"}
                      </button>
                    </div>

                    <a
                      href="https://github.com/fderuiter/portfolio"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-9 rounded-lg border border-zinc-800 px-3 py-2 text-center text-[10px] font-mono text-zinc-400 hover:border-brand-cyan/40 hover:text-brand-cyan"
                    >
                      View source on GitHub ↗
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile Header Actions (Search Button + Hamburger) */}
          <div
            data-testid="navbar-mobile-bar"
            className="xl:max-2xl:@min-[66rem]:hidden 2xl:@min-[78rem]:hidden flex flex-wrap items-center justify-end gap-2 min-w-0 max-w-full ml-auto relative z-50"
          >
            <button
              type="button"
              onClick={openSearch}
              className="flex items-center justify-center min-w-12 min-h-12 rounded-xl border border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:text-brand-cyan transition-colors cursor-pointer"
              aria-label="Open Command Search"
            >
              <IconSearch className="w-4 h-4" />
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
              className="flex items-center justify-center min-w-12 min-h-12 rounded-xl border border-zinc-800 bg-zinc-900/60 text-muted hover:text-foreground transition-colors cursor-pointer"
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

      {/* Mobile Full-Screen Navigation Slide-out */}
      <AnimatePresence>
        {isOpen && (
          <div
            ref={mobileMenuTrapRef}
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsOpen(false);
                if (typeof document !== "undefined") {
                  document.body.style.overflow = "";
                }
              }
            }}
            className="fixed inset-0 z-40 bg-zinc-950/98 backdrop-blur-2xl flex flex-col justify-between pt-[max(6rem,env(safe-area-inset-top)+4.5rem)] pb-[max(2rem,env(safe-area-inset-bottom)+1.5rem)] px-[max(1.5rem,env(safe-area-inset-left)+1rem)] overflow-y-auto"
          >
            {/* Ambient gradients. This drawer is a mobile surface, so the blur
                pair is substituted rather than gated: a radial gradient costs no
                per-frame rasterisation while the drawer scrolls. */}
            <div className="absolute inset-0 sm:hidden pointer-events-none bg-[radial-gradient(circle_at_25%_25%,rgba(34,211,238,0.10),transparent_55%),radial-gradient(circle_at_75%_75%,rgba(59,130,246,0.06),transparent_55%)]" />
            <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-brand-cyan/10 blur-[130px] pointer-events-none hidden sm:block" />
            <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-brand-blue/5 blur-[130px] pointer-events-none hidden sm:block" />

            <div className="relative z-10 flex flex-col gap-6">
              {/* Primary navigation: the same groups as the top bar */}
              <MobileNavSections
                pathname={pathname}
                persona={persona}
                onNavigate={handleNavClick}
              />

              {/* Mobile Persona Toggle */}
              <div className="border-t border-zinc-900/80 pt-4 flex flex-col gap-2.5">
                <div className="flex flex-col gap-1 px-1">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold">
                    Perspective Reading Mode
                  </span>
                  <span
                    id="mobile-reading-mode-desc"
                    className="text-[11px] font-sans text-zinc-400"
                  >
                    {persona === "behind-the-scenes"
                      ? "Behind the Scenes Mode: The candid version, with the engineering stories left in."
                      : "Professional Mode: A concise overview of responsibilities and systems impact."}
                  </span>
                </div>
                <div
                  className="flex p-1 bg-zinc-900 border border-zinc-800 rounded-2xl text-xs font-mono w-full select-none"
                  role="group"
                  aria-label="Reading Mode Selection"
                  aria-describedby="mobile-reading-mode-desc"
                >
                  <button
                    type="button"
                    onClick={() => handlePersonaSelect("behind-the-scenes")}
                    aria-pressed={persona === "behind-the-scenes"}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 min-h-11 py-2.5 rounded-xl font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
                      persona === "behind-the-scenes"
                        ? "bg-zinc-950 text-amber-400 border border-amber-400/20 shadow-[0_0_12px_rgba(251,191,36,0.15)]"
                        : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                    )}
                    aria-label="Switch to Behind the Scenes Mode: Candid reality and engineering stories"
                    title="Behind the Scenes Mode: Candid reality and engineering stories"
                  >
                    <IconFlame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>BEHIND THE SCENES</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePersonaSelect("professional")}
                    aria-pressed={persona === "professional"}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 min-h-11 py-2.5 rounded-xl font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
                      persona === "professional"
                        ? "bg-zinc-950 text-brand-cyan border border-brand-cyan/20 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                        : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                    )}
                    aria-label="Switch to Professional Mode: Concise overview of technical responsibilities and systems impact"
                    title="Professional Mode: Concise overview of technical responsibilities and systems impact"
                  >
                    <IconBriefcase className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
                    <span>PROFESSIONAL</span>
                  </button>
                </div>
              </div>

              {/* Mobile Dyslexia Toggle */}
              <div className="border-t border-zinc-900/80 pt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="font-bold text-sm text-amber-400"
                    aria-hidden="true"
                  >
                    Aa
                  </span>
                  <span className="text-xs font-mono font-bold tracking-wider text-zinc-400">
                    DYSLEXIA FONT
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleDyslexia}
                  aria-pressed={isDyslexic}
                  aria-label={
                    isDyslexic
                      ? "Disable OpenDyslexic font mode"
                      : "Enable OpenDyslexic font mode"
                  }
                  className={cn(
                    "min-h-11 px-4 py-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer flex items-center justify-center",
                    isDyslexic
                      ? "border-amber-400/50 bg-amber-400/15 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                      : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white"
                  )}
                >
                  {isDyslexic ? "OPENDYSLEXIC: ON" : "ENABLE OPENDYSLEXIC"}
                </button>
              </div>

              {/* Mobile Audio Controls */}
              <div className="border-t border-zinc-900/80 pt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {muted ? (
                      <IconVolumeOff className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <IconVolume className="w-4 h-4 text-brand-cyan" />
                    )}
                    <span className="text-xs font-mono font-bold tracking-wider text-zinc-400">
                      SOUND: {muted ? "OFF" : profile.toUpperCase()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMuted(!muted)}
                    className="min-h-11 px-4 py-2 rounded-xl text-xs font-mono font-black border border-zinc-800 bg-zinc-900/50 hover:border-brand-cyan/40 text-brand-cyan transition-all cursor-pointer flex items-center justify-center"
                  >
                    {muted ? "UNMUTE" : "MUTE"}
                  </button>
                </div>

                {/* Volume Slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-mono text-zinc-500">
                    <span>Volume</span>
                    <span>{Math.round(volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    aria-label="Volume"
                    min="0"
                    max="100"
                    value={Math.round(volume * 100)}
                    onChange={(e) =>
                      setVolume(parseFloat(e.target.value) / 100)
                    }
                    disabled={muted}
                    className="w-full h-3 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-brand-cyan disabled:opacity-40"
                  />
                </div>

                {/* Profiles Selection Grid */}
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {(["8-bit", "90s-retro", "ambient"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setProfile(p)}
                      disabled={muted}
                      className={cn(
                        "min-h-11 text-center px-2 py-2 rounded-xl border text-[11px] font-mono tracking-wider transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center",
                        profile === p
                          ? "bg-brand-cyan/10 border-brand-cyan/40 text-brand-cyan font-bold"
                          : "bg-zinc-900/20 border-zinc-900 hover:border-zinc-800 text-zinc-400"
                      )}
                    >
                      {p === "8-bit"
                        ? "8-Bit"
                        : p === "90s-retro"
                          ? "90s"
                          : "Ambient"}
                    </button>
                  ))}
                </div>
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
