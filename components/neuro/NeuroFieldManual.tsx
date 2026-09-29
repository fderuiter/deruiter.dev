"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  IconX,
  IconBook,
  IconBrain,
  IconCpu,
  IconAdjustments,
  IconKeyboard,
  IconShieldCheck,
} from "@tabler/icons-react";

interface NeuroFieldManualProps {
  isOpen: boolean;
  onClose: () => void;
}

const ManualDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const reduceMotion = useReducedMotion();
  const dialogRef = useFocusTrap<HTMLDivElement>(true, {
    onEscape: onClose,
  });
  const [activeTab, setActiveTab] = useState<
    "physics" | "defects" | "shortcuts" | "pipeline"
  >("physics");

  return (
    <motion.div
      key="neuro-field-manual-backdrop"
      initial={{ opacity: reduceMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: reduceMotion ? 1 : 0 }}
      transition={reduceMotion ? { duration: 0 } : undefined}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md"
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="neuro-field-manual-title"
        aria-describedby="neuro-field-manual-desc"
        tabIndex={-1}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={
          reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 10 }
        }
        transition={reduceMotion ? { duration: 0 } : undefined}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[85vh] bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-4 bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center text-brand-cyan">
              <IconBook className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="neuro-field-manual-title"
                className="text-sm font-bold text-white font-mono uppercase tracking-wider"
              >
                NeuroRecon Field Manual · FreeSurfer 7.x
              </h2>
              <p id="neuro-field-manual-desc" className="text-xs text-zinc-400">
                Cortical Reconstruction Physics, Defect Taxonomy, and QA
                Protocol
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Field Manual"
            className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          role="group"
          aria-label="Field Manual sections"
          className="flex items-center border-b border-zinc-800 px-4 bg-zinc-950/30 gap-2 overflow-x-auto"
        >
          {[
            {
              id: "physics",
              label: "Pipeline Physics",
              icon: <IconBrain className="w-3.5 h-3.5" />,
            },
            {
              id: "defects",
              label: "Defect Taxonomy",
              icon: <IconAdjustments className="w-3.5 h-3.5" />,
            },
            {
              id: "pipeline",
              label: "Recon-All Stages",
              icon: <IconCpu className="w-3.5 h-3.5" />,
            },
            {
              id: "shortcuts",
              label: "Keyboard Shortcuts",
              icon: <IconKeyboard className="w-3.5 h-3.5" />,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-1.5 py-3 px-3 text-xs font-mono border-b-2 transition-all select-none ${
                activeTab === tab.id
                  ? "border-brand-cyan text-brand-cyan font-bold"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs font-sans text-zinc-300">
          {activeTab === "physics" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white font-mono uppercase text-brand-cyan mb-1">
                  1. Topological Homeomorphism & Euler Characteristic
                </h3>
                <p className="leading-relaxed">
                  In computational neuroanatomy, the human cerebral cortex is
                  topologically equivalent to a 2-sphere ($S^2$). Under the
                  Euler-Poincaré formula:
                </p>
                <div className="my-2 p-3 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-emerald-400 text-center">
                  \(\chi = V - E + F = 2 - 2g\) (where \(g\) is the topological
                  genus / handle count)
                </div>
                <p className="leading-relaxed">
                  A defect-free cortical mesh has genus \(g = 0\), yielding
                  \(\chi = 2\). Any spurious tissue bridges create handles (\(g
                  \ge 1\)), which must be severed before spherical inflation.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white font-mono uppercase text-brand-cyan mb-1">
                  2. Intensity Normalization & Target Peak (110)
                </h3>
                <p className="leading-relaxed">
                  FreeSurfer scales MRI T1 voxel intensities such that the white
                  matter peak aligns exactly at <strong>110</strong>. If B1
                  transmit field roll-off causes regional WM signal to drop
                  below ~85, the classifier misidentifies it as gray matter,
                  dropping surfaces into gyral cores.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white font-mono uppercase text-brand-cyan mb-1">
                  3. Cortical Thickness Measurement
                </h3>
                <p className="leading-relaxed">
                  Cortical thickness is computed as the minimal Euclidean
                  distance from each vertex on the white surface to the pial
                  surface. Inclusion of non-brain tissue (like dura)
                  artificially inflates thickness values by up to 200%.
                </p>
              </div>
            </div>
          )}

          {activeTab === "defects" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-white font-mono">
                    Dura Over-Inclusion
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    Temporal / Parietal
                  </span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  <strong>Symptom:</strong> Pial surface extends outside cortex
                  to envelop dura mater.
                  <br />
                  <strong>Fix:</strong> Switch to Coronal view, select Voxel
                  Erase (E key), and erase extra-cerebral voxels from{" "}
                  <code className="text-brand-cyan">brainmask.mgz</code>.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-white font-mono">
                    WM Hypointensity Dropout
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    B1 Inhomogeneity
                  </span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  <strong>Symptom:</strong> White surface retracts, creating
                  holes in gyral blades.
                  <br />
                  <strong>Fix:</strong> Place Control Points (C key) in the
                  hypointense white matter (anchor 110), then run{" "}
                  <code className="text-brand-cyan">
                    recon-all -autorecon2-cp
                  </code>
                  .
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-white font-mono">
                    Skull-Strip Over-Erosion
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    Frontal / Occipital Poles
                  </span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  <strong>Symptom:</strong> Portions of cortical gray matter are
                  sliced off outside the mask.
                  <br />
                  <strong>Fix:</strong> Select Voxel Paint (B key) and paint the
                  missing gyri back into{" "}
                  <code className="text-brand-cyan">brainmask.mgz</code>.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-white font-mono">
                    Topological Handles & Bridges
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    Euler Violation
                  </span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  <strong>Symptom:</strong> Non-spherical mesh topology (\(\chi
                  = 0\) instead of \(\chi = 2\)).
                  <br />
                  <strong>Fix:</strong> Identify the spurious voxel bridge
                  across the sulcus and apply a cutting plane with Voxel Erase.
                </p>
              </div>
            </div>
          )}

          {activeTab === "pipeline" && (
            <div className="space-y-4">
              <div className="border-l-2 border-brand-cyan pl-4 space-y-1">
                <div className="font-bold text-white font-mono">
                  Stage 1: Autorecon1 (Motion, Bias & Skullstrip)
                </div>
                <p className="text-zinc-400 text-xs">
                  Runs{" "}
                  <code className="text-brand-cyan">mri_motion_correct2</code>,
                  N3/N4 bias field correction, conform to 1mm isotropic, and
                  skull-stripping via{" "}
                  <code className="text-brand-cyan">mri_watershed</code>.
                </p>
              </div>

              <div className="border-l-2 border-amber-400 pl-4 space-y-1">
                <div className="font-bold text-white font-mono">
                  Stage 2: Autorecon2 (EM Segmentation & Tessellation)
                </div>
                <p className="text-zinc-400 text-xs">
                  Runs GCA atlas registration, subcortical ASEG segmentation,
                  intensity normalization to 110, white matter tessellation,
                  topology defect fixing, and smooth/inflate.
                </p>
              </div>

              <div className="border-l-2 border-emerald-400 pl-4 space-y-1">
                <div className="font-bold text-white font-mono">
                  Stage 3: Autorecon3 (Spherical Reg & Morphometry)
                </div>
                <p className="text-zinc-400 text-xs">
                  Inflates to sphere, performs non-linear spherical registration
                  to <code className="text-brand-cyan">fsaverage</code>, maps
                  Desikan-Killiany and Destrieux atlases, and computes stats
                  tables.
                </p>
              </div>
            </div>
          )}

          {activeTab === "shortcuts" && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "1 / V", desc: "Inspect & Pan Crosshair Tool" },
                {
                  key: "2 / C",
                  desc: "Control Point Placement Tool (110 intensity)",
                },
                { key: "3 / B", desc: "Voxel Paint Brush" },
                { key: "4 / E", desc: "Voxel Erase Brush" },
                {
                  key: "Mouse Wheel",
                  desc: "Scroll through anatomical slices",
                },
                { key: "Space", desc: "Run recon-all pipeline execution" },
                { key: "M / ?", desc: "Open this Field Manual" },
                { key: "Cmd + K", desc: "Site-wide Command Palette" },
              ].map((s) => (
                <div
                  key={s.key}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 font-mono"
                >
                  <span className="text-zinc-400 text-xs">{s.desc}</span>
                  <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-brand-cyan text-xs font-bold">
                    {s.key}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 p-4 bg-zinc-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-1.5 text-amber-400">
            <IconShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              ILLUSTRATIVE SIMULATION · NOT FOR CLINICAL DIAGNOSIS OR PATIENT
              CARE
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-brand-cyan text-zinc-950 font-bold hover:bg-brand-cyan/90 transition-all self-end sm:self-auto min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            DISMISS FIELD MANUAL
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const NeuroFieldManual: React.FC<NeuroFieldManualProps> = ({
  isOpen,
  onClose,
}) => {
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {isOpen && <ManualDialog key="neuro-field-manual" onClose={onClose} />}
    </AnimatePresence>,
    document.body
  );
};
