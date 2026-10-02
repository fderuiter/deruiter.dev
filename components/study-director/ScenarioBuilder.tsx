"use client";

import React, { useRef, useState } from "react";
import { downloadFile } from "@/lib/download";
import { clamp } from "@/lib/game-utils";
import {
  DEFAULT_SCENARIO,
  exportScenarioJson,
  parseScenarioJson,
  type CoordinatorArchetype,
  type MemberArchetype,
  type StudyScenario,
} from "@/lib/study-director";

interface ScenarioBuilderProps {
  scenario: StudyScenario;
  onChange: (next: StudyScenario) => void;
  onClose?: () => void;
}

export const ScenarioBuilder: React.FC<ScenarioBuilderProps> = ({
  scenario,
  onChange,
  onClose,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccessMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseScenarioJson(text);
      if (parsed.success) {
        onChange(parsed.data);
        setSuccessMsg(`Successfully imported scenario "${parsed.data.name}"`);
      } else {
        setError(parsed.error);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.onerror = () => {
      setError("Failed to read scenario file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    const jsonText = exportScenarioJson(scenario);
    const filename = `${scenario.id || "custom"}.scenario.json`;
    downloadFile(jsonText, filename, { mimeType: "application/json" });
  };

  const updateSetup = <K extends keyof StudyScenario["setup"]>(
    key: K,
    val: StudyScenario["setup"][K]
  ) => {
    onChange({
      ...scenario,
      setup: {
        ...scenario.setup,
        [key]: val,
      },
    });
  };

  const updateSiteCoordinator = (
    siteId: string,
    coordinator: CoordinatorArchetype
  ) => {
    onChange({
      ...scenario,
      sites: scenario.sites.map((s) =>
        s.id === siteId ? { ...s, coordinator } : s
      ),
    });
  };

  const updateSiteBurden = (siteId: string, burden: number) => {
    onChange({
      ...scenario,
      sites: scenario.sites.map((s) =>
        s.id === siteId ? { ...s, burden: clamp(burden, 0, 100) } : s
      ),
    });
  };

  const updateMemberArchetype = (
    memberId: string,
    archetype: MemberArchetype
  ) => {
    onChange({
      ...scenario,
      team: scenario.team.map((m) =>
        m.id === memberId ? { ...m, archetype } : m
      ),
    });
  };

  const updateMemberWorkload = (memberId: string, workload: number) => {
    onChange({
      ...scenario,
      team: scenario.team.map((m) =>
        m.id === memberId ? { ...m, workload: clamp(workload, 0, 100) } : m
      ),
    });
  };

  return (
    <div
      data-testid="scenario-builder"
      className="space-y-4 border border-[var(--sd-hairline-strong)] bg-[var(--sd-surface)] p-4 text-xs font-mono text-[var(--sd-text)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--sd-hairline)] pb-3">
        <div>
          <h3 className="text-sm font-bold tracking-wide uppercase text-amber-400">
            Scenario Manager & Builder
          </h3>
          <p className="text-[11px] text-[var(--sd-muted)]">
            Configure protocol parameters, site budgets, coordinator archetypes,
            team workload and risk levels.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".json,.scenario.json"
            onChange={handleFileUpload}
            className="hidden"
            data-testid="scenario-file-input"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="border border-zinc-600 bg-zinc-800/80 px-3 py-1.5 font-bold text-zinc-200 hover:border-amber-400 hover:text-amber-300"
          >
            Import Scenario JSON
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="border border-amber-500/80 bg-amber-500/10 px-3 py-1.5 font-bold text-amber-300 hover:bg-amber-500/20"
          >
            Export .scenario.json
          </button>
          <button
            type="button"
            onClick={() => {
              onChange(DEFAULT_SCENARIO);
              setSuccessMsg("Reset to default preset scenario.");
            }}
            className="border border-zinc-700 px-3 py-1.5 text-[var(--sd-muted)] hover:text-zinc-200"
          >
            Reset Default
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="border border-zinc-700 px-2 py-1.5 text-zinc-400 hover:text-zinc-100"
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="border border-red-500/60 bg-red-950/40 p-2.5 text-red-300">
          <strong>Validation Error:</strong> {error}
        </div>
      ) : null}

      {successMsg ? (
        <div className="border border-emerald-500/60 bg-emerald-950/40 p-2.5 text-emerald-300">
          {successMsg}
        </div>
      ) : null}

      {/* Protocol Parameters & Risk Levels */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label
            htmlFor="protocol-budget"
            className="block text-[10px] text-[var(--sd-muted)] uppercase"
          >
            Protocol Budget ($)
          </label>
          <input
            id="protocol-budget"
            type="number"
            value={scenario.setup.budget}
            onChange={(e) => updateSetup("budget", Number(e.target.value) || 0)}
            className="w-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="protocol-maturity"
            className="block text-[10px] text-[var(--sd-muted)] uppercase"
          >
            Protocol Maturity
          </label>
          <select
            id="protocol-maturity"
            value={scenario.setup.protocolMaturity}
            onChange={(e) =>
              updateSetup(
                "protocolMaturity",
                e.target.value as StudyScenario["setup"]["protocolMaturity"]
              )
            }
            className="w-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
          >
            <option value="solid">Solid</option>
            <option value="questionable">Questionable</option>
            <option value="shaky">Shaky</option>
          </select>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="regulatory-risk"
            className="block text-[10px] text-[var(--sd-muted)] uppercase"
          >
            Regulatory Risk
          </label>
          <select
            id="regulatory-risk"
            value={scenario.setup.regulatoryRisk}
            onChange={(e) =>
              updateSetup(
                "regulatoryRisk",
                e.target.value as StudyScenario["setup"]["regulatoryRisk"]
              )
            }
            className="w-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
          >
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="protocol-complexity"
            className="block text-[10px] text-[var(--sd-muted)] uppercase"
          >
            Complexity (1 - 5)
          </label>
          <input
            id="protocol-complexity"
            type="number"
            min={1}
            max={5}
            value={scenario.setup.complexity}
            onChange={(e) =>
              updateSetup(
                "complexity",
                clamp(Number(e.target.value) || 1, 1, 5)
              )
            }
            className="w-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
          />
        </div>
      </div>

      {/* Sites & Coordinator Archetypes */}
      <div className="border-t border-[var(--sd-hairline)] pt-3">
        <h4 className="text-[11px] font-bold text-zinc-200 uppercase">
          Sites & Coordinator Archetypes
        </h4>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {scenario.sites.map((site) => (
            <div
              key={site.id}
              className="border border-zinc-800 bg-zinc-900/60 p-2 space-y-2"
            >
              <div className="flex items-center justify-between font-bold">
                <span>{site.name}</span>
                <span className="text-[10px] text-[var(--sd-muted)]">
                  {site.id}
                </span>
              </div>

              <div>
                <label
                  htmlFor={`coordinator-${site.id}`}
                  className="block text-[9px] text-[var(--sd-muted)] uppercase"
                >
                  Coordinator
                </label>
                <select
                  id={`coordinator-${site.id}`}
                  value={site.coordinator}
                  onChange={(e) =>
                    updateSiteCoordinator(
                      site.id,
                      e.target.value as CoordinatorArchetype
                    )
                  }
                  className="w-full border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-zinc-100"
                >
                  <option value="steady">Steady</option>
                  <option value="terrified">Terrified</option>
                  <option value="invisible">Invisible</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor={`burden-${site.id}`}
                  className="block text-[9px] text-[var(--sd-muted)] uppercase"
                >
                  Burden ({site.burden})
                </label>
                <input
                  id={`burden-${site.id}`}
                  type="range"
                  min={0}
                  max={100}
                  value={site.burden}
                  onChange={(e) =>
                    updateSiteBurden(site.id, Number(e.target.value) || 0)
                  }
                  className="w-full"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team Archetypes & Workloads */}
      <div className="border-t border-[var(--sd-hairline)] pt-3">
        <h4 className="text-[11px] font-bold text-zinc-200 uppercase">
          Team Member Archetypes & Workloads
        </h4>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {scenario.team.map((member) => (
            <div
              key={member.id}
              className="border border-zinc-800 bg-zinc-900/60 p-2 space-y-2"
            >
              <div className="flex items-center justify-between font-bold">
                <span>{member.name}</span>
                <span className="text-[10px] text-[var(--sd-muted)]">
                  {member.role}
                </span>
              </div>

              <div>
                <label
                  htmlFor={`archetype-${member.id}`}
                  className="block text-[9px] text-[var(--sd-muted)] uppercase"
                >
                  Archetype
                </label>
                <select
                  id={`archetype-${member.id}`}
                  value={member.archetype}
                  onChange={(e) =>
                    updateMemberArchetype(
                      member.id,
                      e.target.value as MemberArchetype
                    )
                  }
                  className="w-full border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-zinc-100"
                >
                  <option value="optimisticStatistician">
                    Optimistic Statistician
                  </option>
                  <option value="veteranDataManager">
                    Veteran Data Manager
                  </option>
                  <option value="veteranMonitor">Veteran Monitor</option>
                  <option value="steadyProfessional">
                    Steady Professional
                  </option>
                  <option value="overloadedStar">Overloaded Star</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor={`workload-${member.id}`}
                  className="block text-[9px] text-[var(--sd-muted)] uppercase"
                >
                  Initial Workload ({member.workload}%)
                </label>
                <input
                  id={`workload-${member.id}`}
                  type="range"
                  min={0}
                  max={100}
                  value={member.workload}
                  onChange={(e) =>
                    updateMemberWorkload(member.id, Number(e.target.value) || 0)
                  }
                  className="w-full"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
