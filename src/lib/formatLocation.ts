// Confidence-based location string. IP-geolocation is approximate, especially
// on cellular and corporate-NAT networks where the gateway IP can sit hundreds
// of km from the actual user. We use MaxMind's accuracy_radius (in km) to
// decide how much detail to claim:
//   ≤ 50 km  → city, country     (high confidence)
//   ≤ 500 km → region, country   (medium)
//   else     → country only      (low)
export function formatLocation(
  city: string | null,
  region: string | null,
  country: string | null,
  accuracyKm: number | null,
): string {
  if (!country && !region && !city) return "—";
  const acc = typeof accuracyKm === "number" ? accuracyKm : 1000;
  const parts: string[] = [];
  if (acc <= 50  && city)   parts.push(city);
  if (acc <= 500 && region && region !== city) parts.push(region);
  if (country)              parts.push(country);
  return parts.join(", ") || country || "—";
}

export const LOCATION_TOOLTIP =
  "IP-based geolocation via MaxMind GeoLite2. Accuracy ~70% for India and 80–90% elsewhere — cellular and corporate networks often resolve to the carrier gateway, not the user's real location. City shown only when MaxMind reports <50km accuracy; otherwise we fall back to region or country.";
