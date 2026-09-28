"use client";

import React, { useState } from "react";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { IconShieldCheck, IconClock } from "@tabler/icons-react";

interface IncidentCard {
  id: string;
  title: string;
  location: string;
  urgency: "HIGH" | "MEDIUM" | "ROUTINE";
  chiefComplaint: string;
  vitals: string;
  status: "pending" | "triaged" | "evacuated";
}

const SAMPLE_INCIDENTS: IncidentCard[] = [
  {
    id: "patrol-101",
    title: "Isolated Femur Fracture",
    location: "Trail 14 - Black Diamond",
    urgency: "HIGH",
    chiefComplaint: "High-energy impact with tree well. Deformed right thigh.",
    vitals: "BP 118/76 · HR 102 · SpO2 98%",
    status: "triaged",
  },
  {
    id: "patrol-102",
    title: "Mild Shoulder Dislocation",
    location: "Mid-Mountain Basin",
    urgency: "MEDIUM",
    chiefComplaint:
      "Fell on outstretched hand while snowboarding. Anterior pain.",
    vitals: "BP 124/80 · HR 88 · SpO2 99%",
    status: "pending",
  },
  {
    id: "patrol-103",
    title: "Mild Hypothermia & Exhaustion",
    location: "Upper Ridge Shelter",
    urgency: "ROUTINE",
    chiefComplaint: "Shivering, wet cotton clothing, fatigue.",
    vitals: "Temp 35.2°C · HR 76 · SpO2 97%",
    status: "pending",
  },
];

export function MobilePatrolClient() {
  const [incidents, setIncidents] = useState<IncidentCard[]>(SAMPLE_INCIDENTS);
  const [selectedIncidentId, setSelectedIncidentId] =
    useState<string>("patrol-101");
  const [activeTab, setActiveTab] = useState<"incidents" | "debrief">(
    "incidents"
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const selectedIncident =
    incidents.find((i) => i.id === selectedIncidentId) || incidents[0];

  const handleAction = (actionLabel: string) => {
    setIncidents((prev) =>
      prev.map((i) =>
        i.id === selectedIncidentId ? { ...i, status: "evacuated" } : i
      )
    );
    setToastMessage(
      `Action '${actionLabel}' executed. Patient stabilized & dispatched.`
    );
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="w-full min-h-screen bg-zinc-950 text-white pb-12 flex flex-col gap-4">
      {/* Mobile Patrol Header */}
      <div className="bg-zinc-900/90 border-b border-zinc-800 p-4 sticky top-16 z-20 backdrop-blur-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <IconShieldCheck className="w-5 h-5 text-brand-cyan" />
            <span className="font-mono text-sm font-bold tracking-wider text-neutral-100">
              PATROL SHIFT (MOBILE)
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 flex items-center gap-1">
            <IconClock className="w-3.5 h-3.5" /> SHIFT ACTIVE
          </span>
        </div>
        <p className="text-xs font-sans text-zinc-300">
          Ski Patrol Outdoor Emergency Transportation &amp; Triage Operations
        </p>
      </div>

      {toastMessage && (
        <div className="mx-4 p-3 rounded-xl bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan text-xs font-mono text-center">
          {toastMessage}
        </div>
      )}

      {/* Main Content Area */}
      <div className="px-4 flex flex-col gap-4">
        {/* Operational Briefing Card */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col gap-2">
          <span className="text-xs font-mono font-bold text-brand-cyan uppercase tracking-wider">
            SHIFT BRIEFING
          </span>
          <p className="text-xs font-sans text-zinc-300">
            Current conditions: Packed powder over ice base. Temp -4°C. Wind 18
            kt NW. Active dispatch desk monitoring 3 mountain incident zones.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 font-mono text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("incidents")}
            className={`min-h-[44px] flex-1 py-2.5 font-bold text-center border-b-2 ${
              activeTab === "incidents"
                ? "border-brand-cyan text-brand-cyan"
                : "border-transparent text-zinc-400"
            }`}
          >
            Incidents Queue ({incidents.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("debrief")}
            className={`min-h-[44px] flex-1 py-2.5 font-bold text-center border-b-2 ${
              activeTab === "debrief"
                ? "border-brand-cyan text-brand-cyan"
                : "border-transparent text-zinc-400"
            }`}
          >
            Debrief &amp; Metrics
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "incidents" && (
          <div className="flex flex-col gap-2.5">
            {incidents.map((incident) => {
              const isSelected = incident.id === selectedIncidentId;
              return (
                <div
                  key={incident.id}
                  onClick={() => setSelectedIncidentId(incident.id)}
                  className={`p-3.5 rounded-xl border flex flex-col gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-zinc-900 border-brand-cyan/60 shadow-md"
                      : "bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-white">
                      {incident.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        incident.urgency === "HIGH"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {incident.urgency}
                    </span>
                  </div>
                  <div className="text-xs font-sans text-zinc-300">
                    Location:{" "}
                    <span className="font-mono text-brand-cyan">
                      {incident.location}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400">
                    Vitals: {incident.vitals}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "debrief" && (
          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 flex flex-col gap-3 font-mono text-xs">
            <span className="font-bold text-brand-cyan">
              Operational Judgment Metrics
            </span>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between p-2.5 rounded bg-zinc-950 border border-zinc-800">
                <span>Medical Accuracy</span>
                <span className="text-emerald-400 font-bold">96%</span>
              </div>
              <div className="flex justify-between p-2.5 rounded bg-zinc-950 border border-zinc-800">
                <span>Safety &amp; Toboggan Control</span>
                <span className="text-emerald-400 font-bold">100%</span>
              </div>
              <div className="flex justify-between p-2.5 rounded bg-zinc-950 border border-zinc-800">
                <span>Team Leadership</span>
                <span className="text-brand-cyan font-bold">92%</span>
              </div>
            </div>
          </div>
        )}

        {/* Selected Incident Actions Card */}
        {selectedIncident && activeTab === "incidents" && (
          <div className="p-4 rounded-2xl bg-zinc-900 border border-brand-cyan/40 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-mono text-xs font-bold text-brand-cyan uppercase">
                TRIAGE &amp; INTERVENTION
              </span>
              <span className="text-xs font-mono text-zinc-400">
                {selectedIncident.id}
              </span>
            </div>
            <p className="text-xs font-sans text-zinc-200">
              {selectedIncident.chiefComplaint}
            </p>
            <div className="flex flex-col gap-2 mt-1">
              <button
                type="button"
                onClick={() =>
                  handleAction("Apply Traction Splint & Toboggan Transport")
                }
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 text-xs font-mono font-bold text-left active:scale-[0.98] transition-all"
              >
                1. Apply Traction Splint &amp; Toboggan Transport
              </button>
              <button
                type="button"
                onClick={() =>
                  handleAction("Administer Rapid Vitals Assessment")
                }
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 text-xs font-mono font-bold text-left active:scale-[0.98] transition-all"
              >
                2. Re-assess Secondary Vitals &amp; Airway
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="px-4 mt-6">
        <NextPrevNav
          prev={{
            title: "NeuroRecon Studio",
            href: "/m/neuro",
            label: "Neuroimaging CAD",
            tag: "Mobile Structural Metrics",
          }}
          next={{
            title: "CRF Studio & EDC",
            href: "/m/crf",
            label: "Clinical Trial Forms",
            tag: "Mobile eCRF",
          }}
          backToHub={{
            title: "Return to Portfolio",
            href: "/",
          }}
        />
      </div>
    </div>
  );
}
