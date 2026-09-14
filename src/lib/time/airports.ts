import airports from "../../../config/data/airports.json";
import { DISPLAY_TZ } from "./zones";

type AirportRecord = { tz: string; he: string; country: string };

const TABLE = airports as unknown as Record<string, AirportRecord | string[]>;

export function isKnownAirport(iata: string): boolean {
  const rec = TABLE[iata.toUpperCase()];
  return !!rec && !Array.isArray(rec) && typeof rec === "object" && "tz" in rec;
}

export function airportRecord(iata: string): AirportRecord | null {
  const rec = TABLE[iata.toUpperCase()];
  if (!rec || Array.isArray(rec) || typeof rec !== "object" || !("tz" in rec)) return null;
  return rec;
}

/**
 * אזור הזמן של שדה תעופה. שדה שלא מוכר נופל לאזור התצוגה — זו הנחה שגויה
 * במפורש, ולכן מדווחת. אין ליפול חזרה בשקט: ראו סעיף 14, אזורי זמן.
 */
export function airportTz(iata: string): { tz: string; assumed: boolean } {
  const rec = airportRecord(iata);
  if (rec) return { tz: rec.tz, assumed: false };
  return { tz: DISPLAY_TZ, assumed: true };
}

export function airportLabel(iata: string): string {
  const rec = airportRecord(iata);
  const code = iata.toUpperCase();
  return rec ? `${rec.he} (${code})` : code;
}

export function allAirports(): Array<{ iata: string } & AirportRecord> {
  return Object.entries(TABLE)
    .filter((e): e is [string, AirportRecord] => !Array.isArray(e[1]) && typeof e[1] === "object" && "tz" in (e[1] as object))
    .map(([iata, rec]) => ({ iata, ...rec }))
    .sort((a, b) => a.he.localeCompare(b.he, "he"));
}
