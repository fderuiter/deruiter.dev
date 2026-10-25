export interface ManualControl {
  key?: string;
  /**
   * The touch control, such as "Tap Jump". Rows built from a game's action
   * map carry it, and the phone manual shows it in place of the key.
   */
  touch?: string;
  action: string;
  description: string;
  icon?: string;
}

export interface ManualRule {
  title: string;
  detail: string;
  badge?: string;
}

export interface EngineeringLore {
  title: string;
  story: string;
  realWorldTech: string[];
}

export interface FieldManualData {
  id: string;
  title: string;
  subtitle: string;
  genre: string;
  badge: string;
  objective: string;
  quickSummary: string;
  controls: ManualControl[];
  rules: ManualRule[];
  proTips: string[];
  lore: EngineeringLore;
  accentColor: string;
  badgeBg: string;
  storageKey?: string;
  route: string;
}
