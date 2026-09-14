/**
 * הרכב הנוסעים.
 *
 * "יחיד / זוג / משפחה / קבוצה" הוא לא שדה קישוט: הוא קובע כמה נוסעים
 * ייווצרו בנסיעה הבאה, משפיע על סוג החדר שמציעים, ועל השאלה אם בכלל
 * צריך לשאול על גילאי ילדים. בחירה אחת חוסכת ארבע הקלדות.
 */

export const PARTY_TYPES = ["solo", "couple", "family", "group"] as const;
export type PartyType = (typeof PARTY_TYPES)[number];

export const PARTY_TYPE_HE: Record<PartyType, string> = {
  solo: "יחיד",
  couple: "זוג",
  family: "משפחה",
  group: "קבוצה",
};

export type Party = {
  partyType: PartyType;
  adults: number;
  children: number;
  infants: number;
  childAges: number[];
};

/** ברירות המחדל שכל בחירה פותחת. אפשר לשנות אותן מיד אחר כך. */
export const PARTY_DEFAULTS: Record<PartyType, { adults: number; children: number; infants: number }> = {
  solo: { adults: 1, children: 0, infants: 0 },
  couple: { adults: 2, children: 0, infants: 0 },
  family: { adults: 2, children: 2, infants: 0 },
  group: { adults: 4, children: 0, infants: 0 },
};

export function isPartyType(v: unknown): v is PartyType {
  return typeof v === "string" && (PARTY_TYPES as readonly string[]).includes(v);
}

/**
 * גילאים נשמרים כמערך JSON. קלט פגום לא מפיל את המסך — לקוח בלי גילאים
 * עדיף על עמוד שקורס.
 */
export function parseChildAges(json: string | null | undefined): number[] {
  if (!json) return [];
  try {
    const v: unknown = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v
      .map((n) => Math.trunc(Number(n)))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 17);
  } catch {
    return [];
  }
}

export function serializeChildAges(ages: number[]): string | null {
  const clean = ages
    .map((n) => Math.trunc(Number(n)))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 17);
  return clean.length ? JSON.stringify(clean) : null;
}

/** סך הנפשות. תינוק נספר — הוא תופס מקום בהזמנה גם בלי מושב. */
export function headcount(p: Pick<Party, "adults" | "children" | "infants">): number {
  return p.adults + p.children + p.infants;
}

function plural(n: number, one: string, two: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${many}`;
}

/**
 * תיאור קצר להצגה בכרטיס: "שני מבוגרים · שני ילדים".
 *
 * מקבל partyType כמחרוזת חופשית ולא כטיפוס המצומצם, כי זה מה שמגיע
 * מהמסד: עמודת טקסט יכולה להכיל ערך ישן או שגוי, ומסך שקורס על זה גרוע
 * מתיאור שנופל חזרה ל"נוסעים".
 */
export function describeParty(
  p: { partyType: string } & Pick<Party, "adults" | "children" | "infants">,
): string {
  const parts: string[] = [];
  if (p.adults > 0) parts.push(plural(p.adults, "מבוגר אחד", "שני מבוגרים", "מבוגרים"));
  if (p.children > 0) parts.push(plural(p.children, "ילד אחד", "שני ילדים", "ילדים"));
  if (p.infants > 0) parts.push(plural(p.infants, "תינוק אחד", "שני תינוקות", "תינוקות"));
  if (parts.length) return parts.join(" · ");
  return isPartyType(p.partyType) ? PARTY_TYPE_HE[p.partyType] : "נוסעים";
}
