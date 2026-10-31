/**
 * Public Data & Terminal Command Contracts for Portfolio Case Studies
 *
 * Governed by ADR 0012, ADR 0016, and issue #3488.
 */

export interface CaseStudyData {
  id: string;
  slug: string;
  title: string;
  primary_language: string;
  github_url: string;
  published: boolean;
  simulated_telemetry: boolean;
  tags: string;
  editorial_content: string;
  architectural_narrative: string;
  external_platform_url?: string | null;
  external_platform_type?: "github" | "kaggle" | "pypi" | "npm" | null;
  interactive_url?: string | null;
  interactive_label?: string | null;
  benchmarks?: Record<string, string | number> | null;
  commands_json?: string;
  playback_json?: string;
  hero_image_url?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CaseStudyCommandDefinition {
  description: string;
  payload: unknown;
}

export type CaseStudyCommands = Record<string, CaseStudyCommandDefinition>;

export interface CaseStudyPlaybackStep {
  command: string;
  description: string;
}

export type CaseStudyPlayback = CaseStudyPlaybackStep[];
