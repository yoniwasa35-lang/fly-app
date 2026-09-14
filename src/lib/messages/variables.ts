/**
 * קטלוג המשתנים שאפשר לשים בתבנית הודעה — סעיף 9.
 * כל משתנה מתועד כאן פעם אחת, והמסך /messages מציג את הרשימה לסוכן.
 */

import { COMPONENT_TYPE_HE, type ComponentType } from "../domain/types";
import { checkinRule } from "../airlines/checkin";
import { airportLabel } from "../time/airports";
import { DISPLAY_TZ, formatAbsoluteHe, formatRelativeHe, utcToZoned } from "../time/zones";

export type VariableDoc = { name: string; description: string; example: string };

export const VARIABLES: VariableDoc[] = [
  { name: "שם", description: "שם הלקוח כפי שהוזן בתיק", example: "משפחת לוי" },
  { name: "שם_פרטי", description: "השם הפרטי לפנייה. בשם כמו \"משפחת לוי\" נשמר השם המלא", example: "דנה" },
  { name: "יעד", description: "היעד הראשי של התיק", example: "רודוס" },
  { name: "מספר_תיק", description: "מספר התיק לתצוגה", example: "2609-114" },
  { name: "תאריך_יציאה", description: "תאריך היציאה", example: "10 באוגוסט" },
  { name: "שעת_יציאה", description: "שעת ההמראה, בשעון שדה היציאה", example: "06:20" },
  { name: "שדה_יציאה", description: "שדה התעופה שממנו יוצאים", example: "תל אביב, נתב\"ג (TLV)" },
  { name: "תאריך_חזרה", description: "תאריך החזרה", example: "17 באוגוסט" },
  { name: "שעת_חזרה", description: "שעת טיסת החזור, בשעון השדה ביעד", example: "21:40" },
  { name: "ימים_ליציאה", description: "כמה זמן נשאר ליציאה", example: "בעוד 3 שבועות" },
  { name: "חברת_תעופה", description: "חברת התעופה של הטיסה הרלוונטית לאבן הדרך", example: "אגאן" },
  { name: "מספר_טיסה", description: "מספר הטיסה הרלוונטית לאבן הדרך", example: "A3 971" },
  { name: "שעת_פתיחת_צקאין", description: "מתי נפתח הצ'ק-אין, בשעון שדה ההמראה", example: "06:20" },
  { name: "תאריך_סגירת_צקאין", description: "התאריך שבו נסגר הצ'ק-אין", example: "10 באוגוסט" },
  { name: "שעת_סגירת_צקאין", description: "השעה שבה נסגר הצ'ק-אין, בשעון שדה ההמראה", example: "05:20" },
  { name: "נוסעים", description: "שמות הנוסעים כפי שהם בדרכון", example: "YOSSI LEVI, MAYA LEVI" },
  { name: "מחיר", description: "המחיר ללקוח", example: "14,200 ₪" },
  { name: "שולם", description: "כמה שולם עד כה", example: "4,000 ₪" },
  { name: "יתרה", description: "היתרה לתשלום", example: "10,200 ₪" },
  { name: "רכיבים", description: "רשימת הרכיבים המאושרים בתיק", example: "טיסה, מלון" },
  { name: "קישור_ללקוח", description: "הקישור האישי לעמוד הנסיעה של הלקוח", example: "https://…/c/xxxx" },
  { name: "שם_סוכן", description: "שם הסוכן לחתימה (משתנה סביבה AGENT_NAME)", example: "יוני" },
  { name: "שם_סוכנות", description: "שם העסק (משתנה סביבה AGENCY_NAME)", example: "נסיעות" },
  { name: "טלפון_חירום", description: "מספר החירום לנסיעה (משתנה סביבה AGENT_EMERGENCY_PHONE)", example: "050-0000000" },
];

export const VARIABLE_NAMES = new Set(VARIABLES.map((v) => v.name));

export type MessageContext = {
  /** הקישור לעמוד הלקוח. ריק אם לא הוגדר PUBLIC_BASE_URL. */
  publicUrl: string;
  trip: {
    code: string;
    destination: string;
    departureAt: Date;
    departureLocal: string;
    departureAirport: string;
    returnAt: Date;
    returnLocal: string;
    priceToClient: number;
    amountPaid: number;
  };
  clientName: string;
  travelerNames: string[];
  components: Array<{ type: string; status: string }>;
  flight: {
    airlineCode: string;
    flightNumber: string;
    departsTz: string;
    checkinOpensAt: Date | null;
    checkinClosesAt: Date | null;
  } | null;
  now: Date;
};

const shekels = (n: number) => `${Math.round(n).toLocaleString("he-IL")} ₪`;

/**
 * תארים ומילות פנייה שאינן שם פרטי. בלעדיהם "משפחת לוי" הופך ל"היי משפחת".
 * אם המילה הראשונה היא אחת מאלה, הפנייה משתמשת בשם המלא.
 */
const NOT_A_FIRST_NAME = new Set([
  "משפחת", "מר", "גברת", "גב", "גב'", "ד\"ר", "דר", "פרופ", "פרופ'", "הרב", "עו\"ד",
]);

export function firstNameOf(fullName: string): string {
  const name = fullName.trim();
  if (!name) return name;
  const [first] = name.split(/\s+/);
  if (NOT_A_FIRST_NAME.has(first.replace(/[.,]$/, ""))) return name;
  return first;
}

/** מחזיר מפה של משתנה → ערך. ערך ריק פירושו "אין מידע", והשולח יראה זאת. */
export function buildVariableValues(ctx: MessageContext): Record<string, string> {
  const { trip, flight } = ctx;

  const airlineName = flight ? (checkinRule(flight.airlineCode).isDefault ? flight.airlineCode : checkinRule(flight.airlineCode).rule.name ?? flight.airlineCode) : "";

  // שעות הצ'ק-אין מוצגות בשעון שדה ההמראה ולא בשעון ישראל: בטיסת החזור
  // הלקוח נמצא ביעד, והשעה שרלוונטית לו היא השעה שם.
  const tz = flight?.departsTz ?? DISPLAY_TZ;

  const confirmed = ctx.components.filter((c) => c.status === "confirmed");

  return {
    "שם": ctx.clientName,
    "שם_פרטי": firstNameOf(ctx.clientName),
    "יעד": trip.destination,
    "מספר_תיק": trip.code,
    "תאריך_יציאה": formatAbsoluteHe(trip.departureAt, { withTime: false }),
    "שעת_יציאה": trip.departureLocal.slice(11, 16),
    "שדה_יציאה": airportLabel(trip.departureAirport),
    "תאריך_חזרה": formatAbsoluteHe(trip.returnAt, { withTime: false }),
    "שעת_חזרה": trip.returnLocal.slice(11, 16),
    "ימים_ליציאה": formatRelativeHe(trip.departureAt, ctx.now).text,
    "חברת_תעופה": airlineName,
    "מספר_טיסה": flight ? `${flight.airlineCode} ${flight.flightNumber}`.trim() : "",
    "שעת_פתיחת_צקאין": flight?.checkinOpensAt ? utcToZoned(flight.checkinOpensAt, tz).slice(11, 16) : "",
    "תאריך_סגירת_צקאין": flight?.checkinClosesAt ? formatAbsoluteHe(flight.checkinClosesAt, { withTime: false, timeZone: tz }) : "",
    "שעת_סגירת_צקאין": flight?.checkinClosesAt ? utcToZoned(flight.checkinClosesAt, tz).slice(11, 16) : "",
    "נוסעים": ctx.travelerNames.join(", "),
    "מחיר": shekels(trip.priceToClient),
    "שולם": shekels(trip.amountPaid),
    "יתרה": shekels(trip.priceToClient - trip.amountPaid),
    "רכיבים": confirmed.map((c) => COMPONENT_TYPE_HE[c.type as ComponentType] ?? c.type).join(", "),
    "קישור_ללקוח": ctx.publicUrl,
    "שם_סוכן": process.env.AGENT_NAME?.trim() ?? "",
    "שם_סוכנות": process.env.AGENCY_NAME?.trim() ?? "",
    "טלפון_חירום": process.env.AGENT_EMERGENCY_PHONE?.trim() ?? "",
  };
}

/** באילו משתנה סביבה תלוי משתנה תבנית — להודעת שגיאה מועילה. */
export const ENV_BACKED: Record<string, string> = {
  "קישור_ללקוח": "PUBLIC_BASE_URL",
  "שם_סוכן": "AGENT_NAME",
  "שם_סוכנות": "AGENCY_NAME",
  "טלפון_חירום": "AGENT_EMERGENCY_PHONE",
};
