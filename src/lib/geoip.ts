import { Reader, type ReaderModel } from "@maxmind/geoip2-node";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

let reader: ReaderModel | null = null;
let triedLoading = false;

// Lazy-load the MaxMind DB on first lookup. If the file is missing (e.g. local
// dev without the .mmdb), we silently return nulls so tracking still works.
function getReader(): ReaderModel | null {
  if (reader || triedLoading) return reader;
  triedLoading = true;
  try {
    const path = join(process.cwd(), "data", "GeoLite2-City.mmdb");
    if (!existsSync(path)) return null;
    reader = Reader.openBuffer(readFileSync(path));
  } catch {
    reader = null;
  }
  return reader;
}

export interface GeoLookup {
  country:    string | null;
  region:     string | null;
  city:       string | null;
  accuracyKm: number | null;  // radius in km; lower = more precise. ISP NAT exits usually report >100km.
}

const EMPTY: GeoLookup = { country: null, region: null, city: null, accuracyKm: null };

export function lookupGeo(ip: string): GeoLookup {
  if (!ip) return EMPTY;
  const r = getReader();
  if (!r) return EMPTY;
  try {
    const res = r.city(ip);
    return {
      country:    res.country?.names.en ?? null,
      region:     res.subdivisions?.[0]?.names.en ?? null,
      city:       res.city?.names.en ?? null,
      accuracyKm: res.location?.accuracyRadius ?? null,
    };
  } catch {
    return EMPTY;
  }
}
