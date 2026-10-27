"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  FORM_TEMPLATES_STORAGE_KEY,
  parseStoredFormTemplates,
  type FormTemplate,
} from "@/lib/crf";
import { STORAGE_CHANGE_EVENT, safeGetRawItem } from "@/lib/safe-storage";

function subscribe(onChange: () => void) {
  window.addEventListener(STORAGE_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(STORAGE_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
const getSnapshot = () => safeGetRawItem(FORM_TEMPLATES_STORAGE_KEY);
const getServerSnapshot = () => null;

/** The author's saved form templates, kept in step with browser storage. */
export function useSavedFormTemplates(): FormTemplate[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => (raw ? parseStoredFormTemplates(raw) : []), [raw]);
}
