import type { VolunteerRiskReportPreferences } from "@/lib/volunteer-risk-report";

export const volunteerPlanStorageKey = "gaokao-volunteer-plan-v1";

export type StoredVolunteerPlanPreferences = VolunteerRiskReportPreferences & {
  preferredCities?: string[];
  preferredMajorCategories?: string[];
};

export type StoredVolunteerPlanDraft<TItem = unknown, TProfile = unknown, TAlgorithm = unknown> = {
  version: 1 | 2;
  savedAt: string;
  profile: TProfile | null;
  items: TItem[];
  preferences?: StoredVolunteerPlanPreferences | null;
  algorithm?: TAlgorithm | null;
};

export function isStoredVolunteerPlanDraft<TItem = unknown, TProfile = unknown, TAlgorithm = unknown>(
  value: unknown,
): value is StoredVolunteerPlanDraft<TItem, TProfile, TAlgorithm> {
  if (typeof value !== "object" || value === null) return false;

  const draft = value as { items?: unknown; savedAt?: unknown };

  return Array.isArray(draft.items) && typeof draft.savedAt === "string";
}
