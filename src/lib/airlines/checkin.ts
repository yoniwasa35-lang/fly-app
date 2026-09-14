import rules from "../../../config/data/airline-checkin-rules.json";
import { zonedToUtc, type NaiveLocal } from "../time/zones";

export type CheckinRule = {
  name?: string;
  opens_minutes_before: number;
  closes_minutes_before: number;
  late_checkin_fee: boolean;
  note?: string;
};

const TABLE = rules as unknown as Record<string, CheckinRule | string[]>;

function isRule(v: unknown): v is CheckinRule {
  return !!v && !Array.isArray(v) && typeof v === "object" && "opens_minutes_before" in (v as object);
}

export function checkinRule(airlineCode: string): { rule: CheckinRule; isDefault: boolean } {
  const found = TABLE[airlineCode.toUpperCase()];
  if (isRule(found)) return { rule: found, isDefault: false };
  const fallback = TABLE["default"];
  if (!isRule(fallback)) throw new Error("חסר כלל ברירת מחדל ב-airline-checkin-rules.json");
  return { rule: fallback, isDefault: true };
}

/**
 * חלונות הצ'ק-אין נגזרים משעת ההמראה בשעון המקומי של שדה היציאה,
 * לא משעון ישראל — סעיף 6.2.
 */
export function checkinWindow(params: {
  airlineCode: string;
  departsAtLocal: NaiveLocal;
  departsTz: string;
}): { opensAt: Date; closesAt: Date; rule: CheckinRule; isDefault: boolean } {
  const { rule, isDefault } = checkinRule(params.airlineCode);
  const departureUtc = zonedToUtc(params.departsAtLocal, params.departsTz);
  return {
    opensAt: new Date(departureUtc.getTime() - rule.opens_minutes_before * 60_000),
    closesAt: new Date(departureUtc.getTime() - rule.closes_minutes_before * 60_000),
    rule,
    isDefault,
  };
}

export function knownAirlines(): Array<{ code: string } & CheckinRule> {
  return Object.entries(TABLE)
    .filter((e): e is [string, CheckinRule] => e[0] !== "default" && isRule(e[1]))
    .map(([code, rule]) => ({ code, ...rule }));
}
