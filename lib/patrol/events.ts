import type { IncidentSeverity, PatrolEvent } from "./types";
import { generateId } from "@/lib/utils";

/**
 * Stub event dispatcher and queue management for patrol shifts.
 */
export function createEvent(
  type: string,
  title: string,
  description: string,
  severity: PatrolEvent["severity"] = "info"
): PatrolEvent {
  return {
    id: generateId("event", { timestamp: true }),
    timestamp: Date.now(),
    scenarioId: "general",
    action: type,
    type,
    title,
    description,
    severity,
  };
}

export type WeatherType =
  | "blizzard"
  | "high_winds"
  | "freeze_thaw"
  | "whiteout"
  | "temperature_drop"
  | "ice_storm"
  | "heavy_snow";

export interface WeatherEventOptions {
  weatherType: WeatherType;
  temperatureFahrenheit?: number;
  windSpeedMph?: number;
  visibility?: "clear" | "moderate" | "poor" | "zero";
  location?: string;
  sector?: string;
}

/**
 * Generates an ambient weather event with calculated operational severity.
 */
export function generateWeatherEvent(
  options: WeatherEventOptions
): PatrolEvent {
  const {
    weatherType,
    temperatureFahrenheit = 20,
    windSpeedMph = 10,
    visibility = "clear",
    location = "Summit Ridge",
    sector = "Main Slope",
  } = options;

  let severity: IncidentSeverity = "info";

  // Critical weather conditions
  if (
    windSpeedMph >= 45 ||
    visibility === "zero" ||
    temperatureFahrenheit <= -15 ||
    (weatherType === "blizzard" && windSpeedMph >= 30) ||
    (weatherType === "whiteout" && windSpeedMph >= 20)
  ) {
    severity = "critical";
  } else if (
    windSpeedMph >= 25 ||
    visibility === "poor" ||
    temperatureFahrenheit <= 0 ||
    weatherType === "ice_storm" ||
    weatherType === "freeze_thaw" ||
    weatherType === "blizzard"
  ) {
    severity = "warning";
  }

  const titleMap: Record<WeatherType, string> = {
    blizzard: "Severe Blizzard Warning",
    high_winds: "High Wind Advisory",
    freeze_thaw: "Freeze-Thaw Surface Crust Alert",
    whiteout: "Zero-Visibility Whiteout Warning",
    temperature_drop: "Extreme Temperature Drop",
    ice_storm: "Freezing Rain & Ice Accumulation Alert",
    heavy_snow: "Heavy Snowfall Accumulation",
  };

  const title = titleMap[weatherType] || "Weather Alert";
  const description = `Weather condition [${weatherType}] reported at ${location} (${sector}). Temp: ${temperatureFahrenheit}°F, Wind: ${windSpeedMph} mph, Visibility: ${visibility}.`;

  return {
    id: generateId("weather", { timestamp: true }),
    timestamp: Date.now(),
    scenarioId: "general",
    action: "WEATHER_ALERT",
    type: "WEATHER_ALERT",
    title,
    description,
    severity,
    context: {
      weatherType,
      temperatureFahrenheit,
      windSpeedMph,
      visibility,
      location,
      sector,
      hazardFlags: {
        frostbiteRisk: temperatureFahrenheit <= 0,
        liftHoldRequired: windSpeedMph >= 40,
        icingHazard:
          weatherType === "ice_storm" || weatherType === "freeze_thaw",
      },
    },
    payload: {
      weatherType,
      severity,
      windSpeedMph,
      temperatureFahrenheit,
    },
  };
}

export interface AmbientEventGeneratorOptions {
  category: "weather" | "hazard" | "operational" | "guest_assist";
  title: string;
  description: string;
  location?: string;
  severity?: IncidentSeverity;
  context?: Record<string, unknown>;
}

/**
 * General ambient event generator for mountain operations.
 */
export function generateAmbientEvent(
  options: AmbientEventGeneratorOptions
): PatrolEvent {
  const {
    category,
    title,
    description,
    location = "Mountain Wide",
    severity = "info",
    context = {},
  } = options;

  return {
    id: generateId(`ambient-${category}`, { timestamp: true }),
    timestamp: Date.now(),
    scenarioId: "general",
    action: `AMBIENT_${category.toUpperCase()}`,
    type: `AMBIENT_${category.toUpperCase()}`,
    title,
    description,
    severity,
    context: {
      category,
      location,
      ...context,
    },
    payload: {
      category,
      severity,
    },
  };
}

/**
 * Filters a list of PatrolEvents by severity.
 */
export function filterEventsBySeverity(
  events: PatrolEvent[],
  severity: IncidentSeverity
): PatrolEvent[] {
  return events.filter((e) => e.severity === severity);
}

/**
 * Filters a list of PatrolEvents by action/type.
 */
export function filterEventsByType(
  events: PatrolEvent[],
  type: string
): PatrolEvent[] {
  return events.filter((e) => e.type === type || e.action === type);
}

/**
 * Sorts PatrolEvents by timestamp.
 */
export function sortEventsByTimestamp(
  events: PatrolEvent[],
  order: "asc" | "desc" = "asc"
): PatrolEvent[] {
  return [...events].sort((a, b) => {
    const tA =
      typeof a.timestamp === "number"
        ? a.timestamp
        : new Date(a.timestamp).getTime();
    const tB =
      typeof b.timestamp === "number"
        ? b.timestamp
        : new Date(b.timestamp).getTime();
    return order === "asc" ? tA - tB : tB - tA;
  });
}

/**
 * Formats a PatrolEvent into a concise log line string.
 */
export function formatEventLog(event: PatrolEvent): string {
  const sev = (event.severity || "info").toUpperCase();
  const title = event.title || event.action || "Event";
  const time =
    typeof event.timestamp === "number"
      ? new Date(event.timestamp).toISOString()
      : String(event.timestamp);
  return `[${time}] [${sev}] ${title}: ${event.description || ""}`.trim();
}

/**
 * Managed Event Queue for active shift events.
 */
export class EventQueue {
  private queue: PatrolEvent[] = [];

  constructor(initialEvents: PatrolEvent[] = []) {
    this.queue = [...initialEvents];
  }

  public enqueue(event: PatrolEvent): void {
    this.queue.push(event);
  }

  public dequeue(): PatrolEvent | undefined {
    return this.queue.shift();
  }

  public peek(): PatrolEvent | undefined {
    return this.queue[0];
  }

  public getEvents(): PatrolEvent[] {
    return [...this.queue];
  }

  public getBySeverity(severity: IncidentSeverity): PatrolEvent[] {
    return filterEventsBySeverity(this.queue, severity);
  }

  public clear(): void {
    this.queue = [];
  }

  public size(): number {
    return this.queue.length;
  }
}
