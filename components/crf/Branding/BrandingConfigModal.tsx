"use client";

import React, { useState, useRef } from "react";
import { StudyBranding } from "@/lib/crf/types";
import {
  BRANDING_PRESETS,
  DEFAULT_STUDY_BRANDING,
} from "@/lib/crf/branding-defaults";
import { ModalContainer } from "@/components/ui/ModalContainer";
import { safeSetRawItem } from "@/lib/safe-storage";
import {
  IconPalette,
  IconX,
  IconUpload,
  IconTrash,
  IconSparkles,
  IconCheck,
  IconDeviceFloppy,
  IconEye,
  IconAlertCircle,
} from "@tabler/icons-react";

interface BrandingConfigModalProps {
  initialBranding?: StudyBranding;
  onSave: (branding: StudyBranding) => void;
  onClose: () => void;
}

export const BrandingConfigModal: React.FC<BrandingConfigModalProps> = ({
  initialBranding,
  onSave,
  onClose,
}) => {
  const [branding, setBranding] = useState<StudyBranding>(
    initialBranding || DEFAULT_STUDY_BRANDING
  );
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleApplyPreset = (presetId: string) => {
    const preset = BRANDING_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setBranding((prev) => ({
        ...preset.branding,
        logoBase64: prev.logoBase64,
        organizationName:
          prev.organizationName || preset.branding.organizationName,
      }));
    }
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setLogoError(
        "Please select a valid image file (PNG, JPG, SVG, or WebP)."
      );
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setLogoError(
        "Image file size exceeds 2MB limit. Please choose a smaller logo file."
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setBranding((prev) => ({ ...prev, logoBase64: base64 }));
    };
    reader.onerror = () => {
      setLogoError("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setBranding((prev) => ({ ...prev, logoBase64: undefined }));
    setLogoError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSaveDefault = () => {
    // The confirmation only shows when the branding actually reached
    // storage; a blocked or full store leaves the button unchanged, as before.
    if (
      typeof window !== "undefined" &&
      !safeSetRawItem("crf_studio_default_branding", JSON.stringify(branding), {
        retainInMemory: false,
      })
    ) {
      return;
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSaveAndClose = () => {
    onSave(branding);
    onClose();
  };

  return (
    <ModalContainer
      isOpen={true}
      onClose={onClose}
      titleId="branding-modal-title"
      maxWidth="max-w-4xl"
      className="bg-zinc-900 border-zinc-750"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan">
            <IconPalette className="w-5 h-5" />
          </span>
          <div>
            <h2
              id="branding-modal-title"
              className="text-base font-bold text-white font-mono uppercase tracking-wide"
            >
              Organization &amp; Sponsor Branding Configurator
            </h2>
            <p className="text-xs text-zinc-400 font-sans">
              Customize clinical logos, color palettes, headers, footers, and
              confidentiality notices across Studio UI, Word (.docx), and PDF
              exports.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <IconX className="w-5 h-5" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Quick Palette Presets */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
              <IconSparkles className="w-3.5 h-3.5 text-brand-cyan" />
              <span>Clinical Palette Presets</span>
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {BRANDING_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset.id)}
                className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800/80 hover:border-zinc-700 text-left transition-all group flex flex-col justify-between space-y-2"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full shadow-sm"
                    style={{ backgroundColor: preset.branding.primaryColor }}
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: preset.branding.accentColor }}
                  />
                </div>
                <div>
                  <div className="text-xs font-bold text-white font-mono group-hover:text-brand-cyan transition-colors">
                    {preset.name}
                  </div>
                  <div className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                    {preset.branding.organizationName}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Organization & Colors */}
          <div className="space-y-4">
            {/* Organization / Sponsor Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 font-mono uppercase">
                Organization / Sponsor Name
              </label>
              <input
                type="text"
                value={branding.organizationName}
                onChange={(e) =>
                  setBranding((prev) => ({
                    ...prev,
                    organizationName: e.target.value,
                  }))
                }
                placeholder="e.g. Aura Oncology Therapeutics"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-200 focus:border-brand-cyan focus:outline-none"
              />
            </div>

            {/* Logo Uploader */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 font-mono uppercase flex items-center justify-between">
                <span>Sponsor Logo (PNG / SVG / JPG)</span>
                {branding.logoBase64 && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 font-mono"
                  >
                    <IconTrash className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                )}
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLogoFileUpload}
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
              />
              {branding.logoBase64 ? (
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between gap-4">
                  <div className="bg-white p-1.5 rounded-lg border border-zinc-700 max-w-[140px] max-h-[50px] flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={branding.logoBase64}
                      alt="Uploaded Logo"
                      className="max-h-8 max-w-full object-contain"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-mono rounded-lg transition-colors"
                  >
                    Change File
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-4 border-2 border-dashed border-zinc-800 hover:border-brand-cyan/60 rounded-xl bg-zinc-950/40 text-center transition-all flex flex-col items-center justify-center gap-1.5 group"
                >
                  <IconUpload className="w-5 h-5 text-zinc-500 group-hover:text-brand-cyan transition-colors" />
                  <span className="text-xs font-mono text-zinc-400 group-hover:text-zinc-200">
                    Upload high-res logo (renders in Word &amp; PDF)
                  </span>
                </button>
              )}
              {logoError && (
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono">
                  <IconAlertCircle className="w-4 h-4 shrink-0" />
                  <span>{logoError}</span>
                </div>
              )}
            </div>

            {/* Color Controls */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 font-mono uppercase">
                  Primary Brand Color
                </label>
                <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl p-1.5">
                  <input
                    type="color"
                    value={branding.primaryColor}
                    onChange={(e) =>
                      setBranding((prev) => ({
                        ...prev,
                        primaryColor: e.target.value,
                      }))
                    }
                    className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={branding.primaryColor}
                    onChange={(e) =>
                      setBranding((prev) => ({
                        ...prev,
                        primaryColor: e.target.value,
                      }))
                    }
                    className="w-full bg-transparent text-xs font-mono text-zinc-200 focus:outline-none uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 font-mono uppercase">
                  Accent Highlight Color
                </label>
                <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl p-1.5">
                  <input
                    type="color"
                    value={branding.accentColor}
                    onChange={(e) =>
                      setBranding((prev) => ({
                        ...prev,
                        accentColor: e.target.value,
                      }))
                    }
                    className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={branding.accentColor}
                    onChange={(e) =>
                      setBranding((prev) => ({
                        ...prev,
                        accentColor: e.target.value,
                      }))
                    }
                    className="w-full bg-transparent text-xs font-mono text-zinc-200 focus:outline-none uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Running Headers & Footers */}
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 font-mono uppercase">
                  Header Running Text
                </label>
                <input
                  type="text"
                  value={branding.headerText || ""}
                  onChange={(e) =>
                    setBranding((prev) => ({
                      ...prev,
                      headerText: e.target.value,
                    }))
                  }
                  placeholder="e.g. CONFIDENTIAL • CLINICAL INVESTIGATION"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-200 focus:border-brand-cyan focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 font-mono uppercase">
                  Footer Running Text
                </label>
                <input
                  type="text"
                  value={branding.footerText || ""}
                  onChange={(e) =>
                    setBranding((prev) => ({
                      ...prev,
                      footerText: e.target.value,
                    }))
                  }
                  placeholder="e.g. CDISC CDASH v2.2 Compliant"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-200 focus:border-brand-cyan focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Confidentiality & Live Simulation Preview */}
          <div className="space-y-4 flex flex-col justify-between">
            {/* Confidentiality Notice */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 font-mono uppercase">
                Confidentiality Disclaimer
              </label>
              <textarea
                rows={3}
                value={branding.confidentialityNotice || ""}
                onChange={(e) =>
                  setBranding((prev) => ({
                    ...prev,
                    confidentialityNotice: e.target.value,
                  }))
                }
                placeholder="Proprietary clinical protocol notice..."
                className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-200 focus:border-brand-cyan focus:outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Live Real-Time Visual Preview Card */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-400 font-mono uppercase flex items-center gap-1.5">
                  <IconEye className="w-3.5 h-3.5 text-brand-cyan" />
                  <span>Live Document Simulation</span>
                </span>
                <span className="text-[10px] font-mono text-zinc-500">
                  Auto-synced
                </span>
              </div>

              {/* Mini Paper Document Card */}
              <div className="bg-white rounded-lg p-3.5 shadow-md border border-zinc-300 text-zinc-900 space-y-2">
                <div
                  className="pb-2 border-b-2 flex items-center justify-between"
                  style={{ borderColor: branding.primaryColor }}
                >
                  <div>
                    {branding.logoBase64 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={branding.logoBase64}
                        alt="Logo"
                        className="h-4 object-contain mb-1"
                      />
                    ) : null}
                    <div
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: branding.primaryColor }}
                    >
                      {branding.organizationName}
                    </div>
                    <div className="text-[9px] font-mono text-zinc-500">
                      Protocol: ONC-2026-003 • Phase III
                    </div>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded text-[8px] font-mono font-bold text-white shadow-xs"
                    style={{ backgroundColor: branding.primaryColor }}
                  >
                    aCRF BOOK
                  </span>
                </div>

                {/* Section simulation */}
                <div className="border border-zinc-200 rounded overflow-hidden">
                  <div
                    className="px-2 py-1 text-[9px] font-bold text-zinc-800 bg-zinc-100 border-l-2"
                    style={{ borderLeftColor: branding.primaryColor }}
                  >
                    Section: Demographics &amp; Baseline
                  </div>
                  <div className="p-2 space-y-1.5 bg-zinc-50">
                    <div className="relative border border-zinc-200 rounded p-1.5 bg-white">
                      <div
                        className="absolute -top-1.5 right-1.5 px-1 py-0.2 rounded text-[7px] font-bold text-white font-mono"
                        style={{ backgroundColor: branding.accentColor }}
                      >
                        DM.BRTHYR [HR]
                      </div>
                      <div className="text-[8px] font-semibold text-zinc-700">
                        Year of Birth *
                      </div>
                      <div className="text-[7px] text-zinc-400 font-mono">
                        _____________________ (YYYY)
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[7px] text-zinc-400 flex items-center justify-between pt-1 border-t border-zinc-100">
                  <span>{branding.footerText || "Confidential Protocol"}</span>
                  <span>Page 1 of 12</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-t border-zinc-800 bg-zinc-950">
        <button
          type="button"
          onClick={handleSaveDefault}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-zinc-300 hover:text-white text-xs font-mono transition-all"
        >
          {savedSuccess ? (
            <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <IconDeviceFloppy className="w-3.5 h-3.5" />
          )}
          <span>
            {savedSuccess
              ? "Saved as Default Template!"
              : "Set as Default Company Profile"}
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 font-mono text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="px-5 py-2 bg-brand-cyan text-black hover:bg-white font-mono text-xs font-bold rounded-xl transition-all shadow-md"
          >
            Apply Branding
          </button>
        </div>
      </div>
    </ModalContainer>
  );
};
