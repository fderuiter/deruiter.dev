import type {
  AreaId,
  Health,
  MeterId,
  Phase,
  Urgency,
} from "@/lib/study-director";

export const METER_LABELS: Record<MeterId, string> = {
  integrity: "Scientific integrity",
  compliance: "Compliance",
  timeline: "Timeline",
  budget: "Budget",
  client: "Client confidence",
  team: "Team capacity",
};

export const AREA_LABELS: Record<AreaId, string> = {
  enrollment: "Enrollment",
  safety: "Safety",
  data: "Data",
  regulatory: "Regulatory",
  budget: "Budget",
  timeline: "Timeline",
};

export const HEALTH_LABELS: Record<Health, string> = {
  green: "On track",
  amber: "Watch",
  red: "Needs action",
};

export const PHASE_LABELS: Record<Phase, string> = {
  protocol: "Protocol",
  startup: "Startup",
  conduct: "Conduct",
  cleaning: "Data cleaning",
  analysis: "Analysis",
  reporting: "Reporting",
  closeout: "Closeout",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  critical: "Critical",
  important: "Important",
  routine: "Routine",
};

export const ROLE_LABELS: Record<string, string> = {
  biostatistician: "Biostatistics",
  dataManager: "Data management",
  regulatory: "Regulatory",
  monitor: "Monitoring",
  medicalWriter: "Medical writing",
  programmer: "Programming",
};

export const COORDINATOR_LABELS = {
  terrified: "Emails about everything",
  invisible: "Says nothing, always fine",
  steady: "Steady and responsive",
} as const;
