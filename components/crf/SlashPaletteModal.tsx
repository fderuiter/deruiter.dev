"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  IconSearch,
  IconX,
  IconSparkles,
  IconFolderPlus,
  IconForms,
  IconWriting,
  IconNumbers,
  IconCalendar,
  IconClock,
  IconSelect,
  IconCheckbox,
  IconCircleDot,
  IconCalculator,
  IconFileText,
  IconTable,
  IconHeartRateMonitor,
  IconTarget,
  IconPill,
  IconAlertTriangle,
  IconUserCheck,
  IconTestPipe,
  IconMoodSmile,
  IconActivity,
  IconCornerDownLeft,
  IconPlus,
} from "@tabler/icons-react";
import {
  SlashCommandItem,
  SlashCommandCategory,
  searchSlashCommands,
  CLINICAL_SMART_BLOCKS,
} from "@/lib/crf";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface SlashPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCommand: (item: SlashCommandItem) => void;
  targetSectionTitle?: string;
  targetIndex?: number;
}

const CATEGORY_TABS: { id: SlashCommandCategory | "all"; label: string }[] = [
  { id: "all", label: "All Items" },
  { id: "smart_block", label: "Smart Blocks" },
  { id: "widget", label: "Field Widgets" },
  { id: "layout", label: "Layout" },
];

function renderItemIcon(item: SlashCommandItem) {
  if (item.category === "smart_block") {
    const sb = CLINICAL_SMART_BLOCKS.find((b) => b.id === item.smartBlockId);
    switch (sb?.iconName) {
      case "IconHeartRateMonitor":
        return <IconHeartRateMonitor className="w-5 h-5 text-rose-400" />;
      case "IconTarget":
        return <IconTarget className="w-5 h-5 text-amber-400" />;
      case "IconPill":
        return <IconPill className="w-5 h-5 text-cyan-400" />;
      case "IconAlertTriangle":
        return <IconAlertTriangle className="w-5 h-5 text-orange-400" />;
      case "IconUserCheck":
        return <IconUserCheck className="w-5 h-5 text-emerald-400" />;
      case "IconTestPipe":
        return <IconTestPipe className="w-5 h-5 text-purple-400" />;
      case "IconMoodSmile":
        return <IconMoodSmile className="w-5 h-5 text-sky-400" />;
      case "IconActivity":
        return <IconActivity className="w-5 h-5 text-teal-400" />;
      default:
        return <IconSparkles className="w-5 h-5 text-brand-cyan" />;
    }
  }

  if (item.action === "insert_section") {
    return <IconFolderPlus className="w-5 h-5 text-indigo-400" />;
  }

  const dt = item.fieldTemplate?.dataType;
  switch (dt) {
    case "integer":
    case "number":
      return <IconNumbers className="w-5 h-5 text-blue-400" />;
    case "date":
      return <IconCalendar className="w-5 h-5 text-emerald-400" />;
    case "time":
      return <IconClock className="w-5 h-5 text-teal-400" />;
    case "single_select":
      return <IconSelect className="w-5 h-5 text-purple-400" />;
    case "multi_select":
      return <IconCheckbox className="w-5 h-5 text-violet-400" />;
    case "radio":
      return <IconCircleDot className="w-5 h-5 text-pink-400" />;
    case "calculated":
      return <IconCalculator className="w-5 h-5 text-amber-400" />;
    case "textarea":
      return <IconFileText className="w-5 h-5 text-zinc-400" />;
    case "repeating_table":
      return <IconTable className="w-5 h-5 text-orange-400" />;
    default:
      return <IconWriting className="w-5 h-5 text-cyan-400" />;
  }
}

/**
 * Keyboard-Accessible Slash Command Palette Modal (#538)
 * Allows authors to quickly search, navigate with keyboard, and insert
 * Clinical Smart Blocks, atomic fields, or layout sections at the active location.
 */
export const SlashPaletteModal: React.FC<SlashPaletteModalProps> = ({
  isOpen,
  onClose,
  onSelectCommand,
  targetSectionTitle,
  targetIndex,
}) => {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<
    SlashCommandCategory | "all"
  >("all");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Track previous values during render to adjust state without useEffect cascading renders
  const [prevQuery, setPrevQuery] = useState(query);
  const [prevCategory, setPrevCategory] = useState(activeCategory);
  if (query !== prevQuery || activeCategory !== prevCategory) {
    setPrevQuery(query);
    setPrevCategory(activeCategory);
    setSelectedIndex(0);
  }

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(isOpen);
    setQuery("");
    setActiveCategory("all");
    setSelectedIndex(0);
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(isOpen);
  }

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen, {
    onEscape: onClose,
  });

  // Filter items based on query and active category tab
  const filteredItems = useMemo(() => {
    const categoryFilter =
      activeCategory === "all" ? undefined : activeCategory;
    return searchSlashCommands(query, categoryFilter);
  }, [query, activeCategory]);

  // Auto-focus search input on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Scroll active item into view
  useEffect(() => {
    if (!listContainerRef.current) return;
    const activeEl = listContainerRef.current.querySelector(
      `[data-index="${selectedIndex}"]`
    );
    if (activeEl) {
      activeEl.scrollIntoView?.({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filteredItems.length > 0) {
        setSelectedIndex((prev) =>
          prev < filteredItems.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filteredItems.length > 0) {
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredItems.length - 1
        );
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredItems[selectedIndex];
      if (selected) {
        onSelectCommand(selected);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-20 px-3 sm:px-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slash-palette-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-2xl bg-zinc-950 border border-zinc-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh] border-brand-cyan/30"
      >
        {/* Header / Search Input */}
        <div className="p-3 sm:p-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-brand-cyan/10 text-brand-cyan">
                <IconSparkles className="w-4 h-4" />
              </span>
              <h2
                id="slash-palette-title"
                className="text-xs font-mono font-bold text-white uppercase tracking-wider"
              >
                Insert Smart Block or Field
              </h2>
            </div>
            {targetSectionTitle && (
              <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[200px]">
                Target: {targetSectionTitle}
                {targetIndex !== undefined ? ` (pos ${targetIndex + 1})` : ""}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              aria-label="Close Slash Palette"
            >
              <IconX className="w-4 h-4" />
            </button>
          </div>

          <div className="relative">
            <IconSearch className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type / or search widgets & smart blocks (e.g. /vitals, /demographics)..."
              className="w-full pl-9 pr-20 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-9 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                aria-label="Clear Search"
              >
                <IconX className="w-3.5 h-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
              ESC
            </kbd>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-0.5">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all shrink-0 ${
                  activeCategory === tab.id
                    ? "bg-brand-cyan text-black font-semibold shadow-sm"
                    : "bg-zinc-850 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results List */}
        <div
          ref={listContainerRef}
          className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5 crf-custom-scrollbar"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 font-mono text-xs space-y-1">
              <IconForms className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p>No matching slash commands found for &ldquo;{query}&rdquo;.</p>
              <p className="text-[11px] text-zinc-600">
                Try searching for /vitals, /demographics, /text, or /section.
              </p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  data-index={index}
                  onClick={() => {
                    onSelectCommand(item);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                    isSelected
                      ? "bg-zinc-850 border-brand-cyan/60 shadow-md text-white"
                      : "bg-zinc-900/50 border-zinc-800/80 hover:bg-zinc-900 text-zinc-300"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-xl border transition-colors shrink-0 ${
                        isSelected
                          ? "bg-zinc-900 border-brand-cyan/40"
                          : "bg-zinc-950 border-zinc-800"
                      }`}
                    >
                      {renderItemIcon(item)}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-semibold text-white group-hover:text-brand-cyan transition-colors truncate">
                          {item.title}
                        </span>
                        <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-brand-cyan">
                          {item.command}
                        </code>
                        {item.badge && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 font-sans line-clamp-1">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Visible Add Button for Touch / Mouse Parity */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isSelected && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-zinc-400 mr-1">
                        <IconCornerDownLeft className="w-3 h-3" />
                        <span>Enter</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCommand(item);
                        onClose();
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1 transition-all ${
                        isSelected
                          ? "bg-brand-cyan text-black font-bold shadow"
                          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                      }`}
                      aria-label={`Insert ${item.title}`}
                    >
                      <IconPlus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-950 text-[10px] font-mono text-zinc-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span>{filteredItems.length} available</span>
        </div>
      </div>
    </div>
  );
};
