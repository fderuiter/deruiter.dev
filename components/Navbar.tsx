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
  IconDeviceGamepad2,
  IconShieldCheck,
  IconTerminal,
  IconCpu,
  IconCrosshair,
  IconBrain,
  IconBone,
  IconFileSpreadsheet,
  IconBriefcase,
  IconFlame,
  IconActivity,
  IconCards,
  IconClipboardCheck,
} from "@tabler/icons-react";

interface SubNavItem {
  title: string;
  subtitle: string;
  href: string;
  icon: React.ReactNode;
  isExternal?: boolean;
}

const ARCADE_ITEMS: SubNavItem[] = [
  {
    title: "Arcade Hub",
    subtitle: "Games, puzzles, and side projects",
    href: "/arcade",
    icon: <IconDeviceGamepad2 className="w-4 h-4 text-brand-cyan" />,
  },
  {
    title: "Laser Loon",
    subtitle: "A loon, lasers, and a trip to the Capitol",
    href: "/arcade/laser-loon",
    icon: <IconCrosshair className="w-4 h-4 text-brand-cyan" />,
  },
  {
    title: "Quasi-Perfect Puzzler",
    subtitle: "Deductive logic puzzle assistant",
    href: "/arcade/quasi-puzzler",
    icon: <IconBrain className="w-4 h-4 text-brand-cyan" />,
  },
  {
    title: "Monkey C Mayhem: Garmin Schvitz App",
    subtitle: "Smartwatch hardware & Garmin Schvitz App simulator",
    href: "/arcade/garmin-watch",
    icon: <IconCpu className="w-4 h-4 text-brand-cyan" />,
  },
  {
    title: "Clinical Trial Chaos",
    subtitle: "Fast-paced medical trial simulator",
    href: "/arcade/clinical-chaos",
    icon: <IconShieldCheck className="w-4 h-4 text-brand-cyan" />,
  },
  {
    title: "Trial & Error: Biostat Ops",
    subtitle: "Clinical-output roguelike deckbuilder",
    href: "/arcade/trial-and-error",
    icon: <IconCards className="w-4 h-4 text-brand-cyan" />,
  },
  {
    title: "Study Director",
    subtitle: "Run a clinical study. Everything is fine.",
    href: "/arcade/study-director",
    icon: <IconClipboardCheck className="w-4 h-4 text-brand-cyan" />,
  },
  {
    title: "Retro Labyrinth",
    subtitle: "Retro procedural dungeon crawler",
    href: "/arcade/retro-labyrinth",
    icon: <IconTerminal className="w-4 h-4 text-brand-cyan" />,
  },
  {
    title: "Working With Duck",
    subtitle: "You have work. Duck has other plans.",
    href: "/arcade/working-with-duck",
    icon: <IconBone className="w-4 h-4 text-brand-cyan" />,
  },
  {
    title: "Meme Vault",
    subtitle: "Soundboard & fun easter egg trophies",
    href: "/arcade/meme-vault",
    icon: <IconDeviceGamepad2 className="w-4 h-4 text-emerald-400" />,
  },
];

const SYSTEMS_ITEMS: SubNavItem[] = [
  {
    title: "Under the Hood (Stack)",
    subtitle: "The tools and decisions behind this site",
    href: "/stack",
    icon: <IconCpu className="w-4 h-4 text-brand-cyan" />,
  },
  {
    title: "CRF Studio",
    subtitle: "Clinical form designer & live trial simulator",
    href: "/crf",
    icon: <IconFileSpreadsheet className="w-4 h-4 text-brand-cyan" />,
  },
  {
    title: "Patrol Shift",
    subtitle: "Midwest ski-patrol operational judgment simulator",
    href: "/patrol",
    icon: <IconShieldCheck className="w-4 h-4 text-brand-cyan" />,
  },
  {
    title: "Proof Workspace",
    subtitle: "Build a proof, one step at a time",
    href: "/proof",
    icon: <IconBrain className="w-4 h-4 text-brand-cyan" />,
  },
  {
    title: "NeuroRecon Studio",
    subtitle: "Interactive 3D MRI brain viewer",
    href: "/neuro",
    icon: <IconBrain className="w-4 h-4 text-brand-cyan" />,
  },
  {
    title: "Incident Simulator",
    subtitle: "Production outage triage simulation",
    href: "/simulator",
    icon: <IconTerminal className="w-4 h-4 text-brand-cyan" />,
  },
  {
    title: "Designing for My Brother",
    subtitle: "Dyslexia-first typography & cognitive accessibility",
    href: "/case-studies/designing-for-my-brother",
    icon: <IconShieldCheck className="w-4 h-4 text-amber-400" />,
  },
];

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

  const handlePersonaSelect = (newPersona: "recruiter" | "technical") => {
    setPersona(newPersona);
    announce(
      newPersona === "technical"
        ? "Switched reading mode to Technical: Deep-dive architecture and engineering details."
        : "Switched reading mode to Recruiter: Executive summary and business impact.",
      "assertive"
    );
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
  const arcadeTriggerRef = useRef<HTMLButtonElement>(null);
  const systemsTriggerRef = useRef<HTMLButtonElement>(null);
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
        const trigger =
          activeDropdown === "arcade"
            ? arcadeTriggerRef.current
            : systemsTriggerRef.current;
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

  const isArcadeActive = pathname.startsWith("/arcade");
  const isSystemsActive =
    pathname === "/proof" ||
    pathname === "/simulator" ||
    pathname === "/crf" ||
    pathname === "/patrol" ||
    pathname.startsWith("/patrol") ||
    pathname === "/neuro" ||
    pathname === "/stack";

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
          className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 flex justify-between items-center w-full gap-4 sm:gap-6 lg:gap-8"
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

          {/* Desktop Navigation Links */}
          <div className="hidden xl:flex items-center gap-2.5 lg:gap-3.5 2xl:gap-5 shrink-0">
            <nav
              className="flex items-center gap-2.5 md:gap-3.5 lg:gap-4.5 shrink-0"
              aria-label="Main Navigation"
            >
              {/* Work Pillar */}
              <Link
                href="/case-studies"
                onClick={() => setActiveDropdown(null)}
                onMouseEnter={handleLinkHover}
                className={cn(
                  "py-1 text-xs font-mono tracking-wider font-semibold transition-all duration-200 hover:text-foreground cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0",
                  pathname === "/case-studies" ||
                    pathname.startsWith("/case-studies/")
                    ? "text-brand-cyan font-bold"
                    : "text-muted"
                )}
              >
                Work
              </Link>

              {/* Blog Pillar */}
              <Link
                href="/blog"
                onClick={() => setActiveDropdown(null)}
                onMouseEnter={handleLinkHover}
                className={cn(
                  "py-1 text-xs font-mono tracking-wider font-semibold transition-all duration-200 hover:text-foreground cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0",
                  pathname === "/blog" || pathname.startsWith("/blog/")
                    ? "text-brand-cyan font-bold"
                    : "text-muted"
                )}
              >
                Blog
              </Link>

              {/* Arcade Dropdown */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowPreferences(false);
                    setActiveDropdown(
                      activeDropdown === "arcade" ? null : "arcade"
                    );
                  }}
                  onMouseEnter={handleLinkHover}
                  className={cn(
                    "py-1 text-xs font-mono tracking-wider font-semibold transition-all duration-200 hover:text-foreground cursor-pointer flex items-center gap-1 focus-visible:ring-1 focus-visible:ring-brand-cyan rounded whitespace-nowrap shrink-0",
                    isArcadeActive || activeDropdown === "arcade"
                      ? "text-brand-cyan font-bold"
                      : "text-muted"
                  )}
                  aria-expanded={activeDropdown === "arcade"}
                  ref={arcadeTriggerRef}
                  aria-controls="arcade-navigation"
                >
                  <span className="whitespace-nowrap">Arcade</span>
                  <IconChevronDown
                    className={cn(
                      "w-3 h-3 transition-transform duration-200 shrink-0",
                      activeDropdown === "arcade"
                        ? "rotate-180 text-brand-cyan"
                        : "text-zinc-500"
                    )}
                  />
                </button>

                <AnimatePresence>
                  {activeDropdown === "arcade" && (
                    <motion.div
                      key="arcade-navigation"
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 mt-3 w-[calc(100vw-2rem)] sm:w-80 max-w-[calc(100vw-2rem)] p-2.5 rounded-2xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(6,182,212,0.08)] z-50 flex flex-col gap-1"
                      id="arcade-navigation"
                    >
                      <div className="px-3 py-1.5 border-b border-zinc-800/80 mb-1 flex items-center justify-between min-w-0">
                        <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-zinc-400 truncate">
                          Arcade
                        </span>
                        <span className="text-[9px] font-mono text-brand-cyan shrink-0 ml-2">
                          60 FPS
                        </span>
                      </div>
                      {ARCADE_ITEMS.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setActiveDropdown(null)}
                            onMouseEnter={handleLinkHover}
                            className={cn(
                              "flex items-start gap-3 p-2.5 rounded-xl transition-all duration-150 group min-w-0",
                              isActive
                                ? "bg-brand-cyan/10 border border-brand-cyan/30 text-white"
                                : "hover:bg-zinc-900/80 text-zinc-300 hover:text-white"
                            )}
                          >
                            <div className="mt-0.5 p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 group-hover:border-brand-cyan/30 transition-colors shrink-0">
                              {item.icon}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-mono font-bold tracking-tight text-neutral-200 group-hover:text-brand-cyan transition-colors truncate">
                                {item.title}
                              </span>
                              <span className="text-[11px] font-sans text-zinc-400 truncate">
                                {item.subtitle}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Systems & Proof Dropdown */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowPreferences(false);
                    setActiveDropdown(
                      activeDropdown === "systems" ? null : "systems"
                    );
                  }}
                  onMouseEnter={handleLinkHover}
                  className={cn(
                    "py-1 text-xs font-mono tracking-wider font-semibold transition-all duration-200 hover:text-foreground cursor-pointer flex items-center gap-1 focus-visible:ring-1 focus-visible:ring-brand-cyan rounded whitespace-nowrap shrink-0",
                    isSystemsActive || activeDropdown === "systems"
                      ? "text-brand-cyan font-bold"
                      : "text-muted"
                  )}
                  aria-expanded={activeDropdown === "systems"}
                  ref={systemsTriggerRef}
                  aria-controls="systems-navigation"
                >
                  <span className="whitespace-nowrap">Systems</span>
                  <IconChevronDown
                    className={cn(
                      "w-3 h-3 transition-transform duration-200 shrink-0",
                      activeDropdown === "systems"
                        ? "rotate-180 text-brand-cyan"
                        : "text-zinc-500"
                    )}
                  />
                </button>

                <AnimatePresence>
                  {activeDropdown === "systems" && (
                    <motion.div
                      key="systems-navigation"
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 mt-3 w-[calc(100vw-2rem)] sm:w-72 max-w-[calc(100vw-2rem)] p-2.5 rounded-2xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(6,182,212,0.08)] z-50 flex flex-col gap-1"
                      id="systems-navigation"
                    >
                      <div className="px-3 py-1.5 border-b border-zinc-800/80 mb-1 min-w-0">
                        <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-zinc-400 truncate block">
                          Workspaces &amp; Verification
                        </span>
                      </div>
                      {SYSTEMS_ITEMS.filter(
                        (item) =>
                          !(
                            persona === "technical" &&
                            item.href === "/simulator"
                          )
                      ).map((item) => {
                        const isActive = pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setActiveDropdown(null)}
                            onMouseEnter={handleLinkHover}
                            className={cn(
                              "flex items-start gap-3 p-2.5 rounded-xl transition-all duration-150 group min-w-0",
                              isActive
                                ? "bg-brand-cyan/10 border border-brand-cyan/30 text-white"
                                : "hover:bg-zinc-900/80 text-zinc-300 hover:text-white"
                            )}
                          >
                            <div className="mt-0.5 p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 group-hover:border-brand-cyan/30 transition-colors shrink-0">
                              {item.icon}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-mono font-bold tracking-tight text-neutral-200 group-hover:text-brand-cyan transition-colors truncate">
                                {item.title}
                              </span>
                              <span className="text-[11px] font-sans text-zinc-400 truncate">
                                {item.subtitle}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* About Pillar */}
              <Link
                href="/#about"
                onClick={(e) => handleNavClick(e, "/#about")}
                onMouseEnter={handleLinkHover}
                className={cn(
                  "py-1 text-xs font-mono tracking-wider font-semibold transition-all duration-200 hover:text-foreground cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0",
                  pathname === "/" && activeSection === "about"
                    ? "text-brand-cyan font-bold"
                    : "text-muted"
                )}
              >
                About
              </Link>

              {/* Contact Pillar */}
              <Link
                href={pathname === "/" ? "/#contact" : "/contact"}
                onClick={(e) => {
                  if (pathname === "/") {
                    handleNavClick(e, "/#contact");
                  } else {
                    setActiveDropdown(null);
                  }
                }}
                onMouseEnter={handleLinkHover}
                className={cn(
                  "py-1 text-xs font-mono tracking-wider font-semibold transition-all duration-200 hover:text-foreground cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0",
                  (pathname === "/" && activeSection === "contact") ||
                    pathname === "/contact"
                    ? "text-brand-cyan font-bold"
                    : "text-muted"
                )}
              >
                Contact
              </Link>

              {/* GitHub External */}
              <a
                href="https://github.com/fderuiter/portfolio"
                target="_blank"
                rel="noopener noreferrer"
                onMouseEnter={handleLinkHover}
                className="hidden 2xl:flex py-1 text-xs font-mono tracking-wider font-semibold text-muted hover:text-foreground transition-all duration-200 cursor-pointer items-center gap-1 group whitespace-nowrap shrink-0"
                aria-label="View source repository on GitHub"
              >
                <span>GitHub</span>
                <span className="text-[10px] text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  ↗
                </span>
              </a>
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
                onClick={() => handlePersonaSelect("technical")}
                aria-pressed={persona === "technical"}
                aria-label="Switch to Technical Reading Mode: Deep-dive architecture and engineering details"
                title="Technical Reading Mode: Deep-dive architecture and engineering details"
                className={cn(
                  "flex items-center justify-center gap-1 px-2 md:px-2.5 py-1.5 rounded-lg font-bold transition-all duration-200 cursor-pointer min-h-8 shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-950",
                  persona === "technical"
                    ? "bg-zinc-950 text-amber-400 border border-amber-400/20 shadow-[0_0_8px_rgba(251,191,36,0.15)]"
                    : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                )}
              >
                <IconFlame className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden 2xl:inline">TECHNICAL</span>
                <span className="hidden xl:inline 2xl:hidden">TECH</span>
              </button>
              <button
                type="button"
                onClick={() => handlePersonaSelect("recruiter")}
                aria-pressed={persona === "recruiter"}
                aria-label="Switch to Recruiter Reading Mode: Executive summary and business impact"
                title="Recruiter Reading Mode: Executive summary and business impact"
                className={cn(
                  "flex items-center justify-center gap-1 px-2 md:px-2.5 py-1.5 rounded-lg font-bold transition-all duration-200 cursor-pointer min-h-8 shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-950",
                  persona === "recruiter"
                    ? "bg-zinc-950 text-brand-cyan border border-brand-cyan/20 shadow-[0_0_8px_rgba(6,182,212,0.15)]"
                    : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                )}
              >
                <IconBriefcase className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden 2xl:inline">RECRUITER</span>
                <span className="hidden xl:inline 2xl:hidden">REC</span>
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
                        {persona === "technical"
                          ? "Technical Mode: Deep-dive architecture, code, and systems."
                          : "Recruiter Mode: High-level overview, business impact, and leadership."}
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
                        onClick={() => handlePersonaSelect("technical")}
                        aria-pressed={persona === "technical"}
                        className={cn(
                          "min-h-9 flex-1 rounded-lg px-2 font-bold flex items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
                          persona === "technical"
                            ? "bg-zinc-950 text-amber-400"
                            : "text-zinc-500 hover:text-zinc-300"
                        )}
                        aria-label="Switch to Technical Reading Mode: Deep-dive architecture and engineering details"
                        title="Technical Reading Mode: Deep-dive architecture and engineering details"
                      >
                        <IconFlame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>TECH</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePersonaSelect("recruiter")}
                        aria-pressed={persona === "recruiter"}
                        className={cn(
                          "min-h-9 flex-1 rounded-lg px-2 font-bold flex items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
                          persona === "recruiter"
                            ? "bg-zinc-950 text-brand-cyan"
                            : "text-zinc-500 hover:text-zinc-300"
                        )}
                        aria-label="Switch to Recruiter Reading Mode: Executive summary and business impact"
                        title="Recruiter Reading Mode: Executive summary and business impact"
                      >
                        <IconBriefcase className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
                        <span>RECRUITER</span>
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
          <div className="xl:hidden flex items-center gap-2 relative z-50">
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
              {/* Primary Navigation Sections */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Core Section */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold px-1">
                    Primary Navigation
                  </span>
                  <Link
                    href="/case-studies"
                    onClick={() => setIsOpen(false)}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-base font-bold text-neutral-200 hover:text-brand-cyan hover:border-brand-cyan/30 flex items-center justify-between active:scale-[0.99] transition-all"
                  >
                    <span>Work</span>
                    <span className="text-xs font-mono text-zinc-500">→</span>
                  </Link>
                  <Link
                    href="/blog"
                    onClick={() => setIsOpen(false)}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-base font-bold text-neutral-200 hover:text-brand-cyan hover:border-brand-cyan/30 flex items-center justify-between active:scale-[0.99] transition-all"
                  >
                    <span>Blog</span>
                    <span className="text-xs font-mono text-zinc-500">→</span>
                  </Link>
                  <Link
                    href="/#about"
                    onClick={(e) => handleNavClick(e, "/#about")}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-base font-bold text-neutral-200 hover:text-brand-cyan hover:border-brand-cyan/30 flex items-center justify-between active:scale-[0.99] transition-all"
                  >
                    <span>About &amp; Experience</span>
                    <span className="text-xs font-mono text-zinc-500">→</span>
                  </Link>
                  <Link
                    href="/contact"
                    onClick={(e) => handleNavClick(e, "/contact")}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-base font-bold text-neutral-200 hover:text-brand-cyan hover:border-brand-cyan/30 flex items-center justify-between active:scale-[0.99] transition-all"
                  >
                    <span>Contact</span>
                    <span className="text-xs font-mono text-zinc-500">→</span>
                  </Link>
                  <Link
                    href="/schedule"
                    onClick={(e) => handleNavClick(e, "/schedule")}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-sm font-semibold text-neutral-300 hover:text-white flex items-center justify-between active:scale-[0.99] transition-all"
                  >
                    <span>Office Hours &amp; Schedule</span>
                    <span className="text-xs font-mono text-zinc-500">→</span>
                  </Link>
                </div>

                {/* Interactive Tools & Arcade */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold px-1">
                    Systems
                  </span>
                  <Link
                    href="/m/crf"
                    onClick={(e) => handleNavClick(e, "/m/crf")}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-sm font-semibold text-neutral-200 hover:text-brand-cyan flex items-center justify-between gap-2 active:scale-[0.99] transition-all min-w-0"
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
                    href="/m/patrol"
                    onClick={(e) => handleNavClick(e, "/m/patrol")}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-sm font-semibold text-neutral-200 hover:text-brand-cyan flex items-center justify-between gap-2 active:scale-[0.99] transition-all min-w-0"
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
                    href="/m/proof"
                    onClick={(e) => handleNavClick(e, "/m/proof")}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-sm font-semibold text-neutral-200 hover:text-brand-cyan flex items-center justify-between gap-2 active:scale-[0.99] transition-all min-w-0"
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
                    href="/m/neuro"
                    onClick={(e) => handleNavClick(e, "/m/neuro")}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-sm font-semibold text-neutral-200 hover:text-brand-cyan flex items-center justify-between gap-2 active:scale-[0.99] transition-all min-w-0"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <IconBrain className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="truncate">NeuroRecon Studio</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 shrink-0">
                      3D MRI
                    </span>
                  </Link>
                  <Link
                    href="/stack"
                    onClick={(e) => handleNavClick(e, "/stack")}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-sm font-semibold text-neutral-200 hover:text-brand-cyan flex items-center justify-between gap-2 active:scale-[0.99] transition-all min-w-0"
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
                      onClick={(e) => handleNavClick(e, "/simulator")}
                      className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-sm font-semibold text-neutral-200 hover:text-brand-cyan flex items-center justify-between gap-2 active:scale-[0.99] transition-all min-w-0"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <IconActivity className="w-4 h-4 text-brand-cyan shrink-0" />
                        <span className="truncate">Incident Simulator</span>
                      </span>
                      <span className="text-[10px] font-mono text-brand-cyan px-1.5 py-0.5 rounded bg-brand-cyan/10 shrink-0">
                        Outage Drill
                      </span>
                    </Link>
                  )}
                  <Link
                    href="/arcade"
                    onClick={(e) => handleNavClick(e, "/arcade")}
                    className="min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-base font-bold text-brand-cyan hover:bg-brand-cyan/10 flex items-center justify-between gap-2 active:scale-[0.99] transition-all min-w-0"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <IconDeviceGamepad2 className="w-4 h-4 shrink-0" />
                      <span className="truncate">Arcade</span>
                    </span>
                    <span className="text-xs font-mono text-brand-cyan shrink-0">
                      6 Games
                    </span>
                  </Link>
                </div>
              </div>

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
                    {persona === "technical"
                      ? "Technical Mode: Deep-dive architecture, code, and systems."
                      : "Recruiter Mode: High-level overview, business impact, and leadership."}
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
                    onClick={() => handlePersonaSelect("technical")}
                    aria-pressed={persona === "technical"}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 min-h-11 py-2.5 rounded-xl font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
                      persona === "technical"
                        ? "bg-zinc-950 text-amber-400 border border-amber-400/20 shadow-[0_0_12px_rgba(251,191,36,0.15)]"
                        : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                    )}
                    aria-label="Switch to Technical Reading Mode: Deep-dive architecture and engineering details"
                    title="Technical Reading Mode: Deep-dive architecture and engineering details"
                  >
                    <IconFlame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>TECHNICAL</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePersonaSelect("recruiter")}
                    aria-pressed={persona === "recruiter"}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 min-h-11 py-2.5 rounded-xl font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
                      persona === "recruiter"
                        ? "bg-zinc-950 text-brand-cyan border border-brand-cyan/20 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                        : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                    )}
                    aria-label="Switch to Recruiter Reading Mode: Executive summary and business impact"
                    title="Recruiter Reading Mode: Executive summary and business impact"
                  >
                    <IconBriefcase className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
                    <span>RECRUITER</span>
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
