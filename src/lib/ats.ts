export const ATS_OPTIONS = [
  { value: "workday",      label: "Workday"            },
  { value: "sap_sf",       label: "SAP SuccessFactors" },
  { value: "oracle_hcm",   label: "Oracle HCM"         },
  { value: "oracle_taleo", label: "Oracle Taleo"       },
] as const;

export type AtsValue = typeof ATS_OPTIONS[number]["value"];

export const ATS_VALUES: readonly string[] = ATS_OPTIONS.map(o => o.value);

// Maps free-text HCM/ATS labels from Excel uploads and clipboard pastes
// to the canonical enum values we store in `dataset_rows.ats_type`.
// Keys are normalized (lowercased, trimmed) before lookup.
export const HCM_MAP: Record<string, AtsValue> = {
  "workday":            "workday",
  "oracle hcm":         "oracle_hcm",
  "oracle hcm cloud":   "oracle_hcm",
  "oracle taleo":       "oracle_taleo",
  "taleo":              "oracle_taleo",
  "sap successfactors": "sap_sf",
  "successfactors":     "sap_sf",
  "sap sf":             "sap_sf",
};

// Resolves a raw label (e.g. "Workday", "SAP SuccessFactors", "sap_sf")
// to a canonical AtsValue, or null if unrecognized.
export function resolveAtsValue(raw: string): AtsValue | null {
  const norm = raw.trim().toLowerCase();
  if (!norm) return null;
  if (ATS_VALUES.includes(norm)) return norm as AtsValue;
  return HCM_MAP[norm] ?? null;
}
