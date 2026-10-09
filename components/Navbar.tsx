"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { isModifiedClick, scrollToElement } from "@/lib/scroll";
import { useAudio } from "@/components/providers/AudioProvider";
import { useSearch } from "@/components/providers/SearchProvider";
import { usePersona } from "@/components/providers/PersonaProvider";
import { isNavGroupActive, isNavMenu, PRIMARY_NAV } from "@/lib/navigation";
import { DesktopNavMenu } from "@/components/nav/DesktopNavMenu";
import { MobileNavSections } from "@/components/nav/MobileNavSections";
import {
  PreferencesMenu,
  PreferencesPanel,
} from "@/components/nav/PreferencesMenu";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useResizeObserver } from "@/hooks/useResizeObserver";
import { IconSearch } from "@tabler/icons-react";

export const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const { playHover } = useAudio();
  const { openSearch } = useSearch();
  const { persona } = usePersona();
  const [showPreferences, setShowPreferences] = useState(false);

  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setIsOpen(false);
    setActiveDropdown(null);
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

  // Accessibility: Esc key listener for desktop disclosures and the preferences panel.
  // Escape must still close a panel while focus is on one of its controls, so
  // it is allowed in inputs. It listens on document so it runs before the
  // window-level focus trap listeners.
  useHotkeys(
    "Escape",
    () => {
      if (showPreferences) {
        setShowPreferences(false);
        preferencesTriggerRef.current?.focus();
      } else if (activeDropdown) {
        const trigger = menuTriggerRefs.current[activeDropdown];
        setActiveDropdown(null);
        trigger?.focus();
      }
    },
    {
      enabled: Boolean(activeDropdown || showPreferences),
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
              the row widens to 80rem (#1659); the group is narrower now that
              one Preferences menu replaces the reading-mode, dyslexia and
              sound controls, but the breakpoints are kept (#1847). */}
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

            <PreferencesMenu
              isOpen={showPreferences}
              onToggle={() => {
                setActiveDropdown(null);
                setShowPreferences((isVisible) => !isVisible);
              }}
              onClose={() => setShowPreferences(false)}
              triggerRef={preferencesTriggerRef}
            />
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

              {/* Preferences: reading mode, sound and text, the same panel as
                  the desktop menu */}
              <div className="border-t border-zinc-900/80 pt-4">
                <PreferencesPanel variant="drawer" />
              </div>
            </div>

            <div className="relative z-10 pt-4 border-t border-zinc-900 flex items-center justify-between text-xs font-mono text-zinc-500">
              <span>© 2026 FREDERICK DE RUITER</span>
              <a
                href="https://github.com/fderuiter/deruiter.dev"
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
