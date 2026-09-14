/**
 * עמוד הלקוח — סעיף 8.4.
 *
 * זה הקובץ הרגיש ביותר במערכת: הוא מייצר את המידע היחיד שיוצא ל-URL פתוח,
 * בלי התחברות. לכן הוא בנוי כרשימה לבנה מפורשת. אין כאן שאילתה שמחזירה
 * תיק ואז מסתירה שדות בתצוגה — יש שאילתה שבוחרת מראש רק את מה שמותר, כדי
 * שהוספת שדה למודל לא תדלוף לכאן בשקט.
 *
 * מה שלעולם לא יוצא: מספרי דרכון, תאריכי לידה, עלויות ספקים, רווחים,
 * שיעור נתח הסוכנות, הערות פנימיות, ושמות ספקים.
 */

import { prisma } from "../db";
import {
  COMPONENT_TYPE_HE,
  isComponentResolved,
  type ComponentType,
  type TripStatus,
} from "../domain/types";
import { airportLabel } from "../time/airports";
import { nightsBetween } from "./summary";
import { checkinRule } from "../airlines/checkin";
import { DISPLAY_TZ, formatAbsoluteHe, formatRelativeHe, utcToZoned } from "../time/zones";
import {
  BOARD_BASIS_HE,
  isBoardBasis,
  mapUrl,
  ratingLabel,
  safeExternalUrl,
  starsLabel,
} from "./stay";

export type PublicFlight = {
  direction: "outbound" | "inbound";
  airline: string;
  flightNumber: string;
  fromAirport: string;
  toAirport: string;
  departsLabel: string;
  departsTime: string;
  /** null כשהיא לא נקלטה. עדיף לא להציג מאשר להציג שעה שגויה ללקוח. */
  arrivesTime: string | null;
  reference: string | null;
  baggage: string | null;
  checkinOpensLabel: string | null;
  checkinClosesLabel: string | null;
  /** מתי החלון נפתח בפועל, כדי לדעת אם בכלל להציג משימה ללקוח. */
  checkinOpensAt: Date | null;
  checkinDone: boolean;
  /** נכון רק לחברות שגובות על צ'ק-אין בשדה — משנה את דחיפות ההודעה. */
  lateCheckinCosts: boolean;
};

/**
 * המלון כפי שהלקוח רואה אותו.
 *
 * מה שאינו כאן חשוב כמו מה שכן: אין עלות, אין ספק, אין מספר ההזמנה של
 * הסוכן מול הספק. יש את מה שעוזר למי שמגיע לקבלה.
 */
export type PublicStay = {
  name: string;
  stars: string | null;
  rating: string | null;
  address: string | null;
  roomType: string | null;
  board: string | null;
  checkInLabel: string;
  checkOutLabel: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  nights: number;
  /** null כשאין — ואז הכפתור פשוט לא מופיע. לא ממציאים כתובת. */
  officialUrl: string | null;
  voucherUrl: string | null;
  mapUrl: string;
  /** יתמלא כשיוגדר מפתח ל-Places. עד אז ריק, והגלריה לא מוצגת. */
  photos: string[];
};

export type PublicBooked = { type: string; description: string; reference: string | null };

export type PublicTodo =
  | { kind: "balance"; label: string; detail: string }
  | { kind: "passports"; label: string; detail: string }
  | { kind: "insurance"; label: string; detail: string }
  | { kind: "checkin"; label: string; detail: string };

export type PublicUpsell = { id: string; label: string; detail: string | null };

/**
 * שלב הנסיעה כפי שהלקוח חווה אותו. נגזר מהזמן עצמו ולא רק מהסטטוס במסד,
 * כי הסטטוס מתקדם ב-job היומי — ולקוח שפותח את העמוד בשלוש לפנות בוקר
 * אחרי ההמראה לא אמור לראות ספירה לאחור שלילית.
 */
export type TripPhase = "before" | "traveling" | "returned";

export type PublicTrip = {
  code: string;
  clientName: string;
  destination: string;
  status: TripStatus;
  phase: TripPhase;
  traveling: boolean;
  departureAt: Date;
  returnAt: Date;
  countdown: string;
  departureLabel: string;
  returnLabel: string;
  travelerCount: number;
  nights: number;
  cover: { url: string; credit: string | null } | null;
  stay: PublicStay | null;
  booked: PublicBooked[];
  flights: PublicFlight[];
  todos: PublicTodo[];
  upsells: PublicUpsell[];
  agent: { name: string; phone: string; agency: string };
  /** טיסת החזור, לתצוגה בראש העמוד בזמן הנסיעה. */
  inbound: PublicFlight | null;
};

function airlineName(code: string): string {
  const { rule, isDefault } = checkinRule(code);
  return isDefault ? code.toUpperCase() : (rule.name ?? code.toUpperCase());
}

export async function getPublicTrip(token: string, now = new Date()): Promise<PublicTrip | null> {
  if (!token || token.length < 16) return null;

  const trip = await prisma.trip.findUnique({
    where: { publicToken: token },
    // רשימה לבנה. אין כאן include גורף בכוונה.
    select: {
      code: true,
      destination: true,
      status: true,
      departureAt: true,
      returnAt: true,
      coverImageUrl: true,
      coverCredit: true,
      priceToClient: true,
      amountPaid: true,
      client: { select: { name: true } },
      travelers: { select: { id: true, passportNumberEnc: true, passportExpiry: true } },
      components: {
        select: {
          id: true, type: true, description: true, reference: true, status: true,
          isUpsell: true, clientResponse: true,
          flight: {
            select: {
              direction: true, airlineCode: true, flightNumber: true,
              departsAtLocal: true, departsTz: true, departsAirport: true,
              arrivesAtLocal: true, arrivesAirport: true,
              checkinOpensAt: true, checkinClosesAt: true, checkinDone: true,
              baggageAllowance: true,
            },
          },
          /*
           * רשימה לבנה גם כאן. photosJson ו-placeId נשארים בחוץ: הלקוח
           * מקבל כתובות תמונה מוכנות, לא מזהים פנימיים.
           */
          stay: {
            select: {
              name: true, roomType: true, boardBasis: true,
              checkInTime: true, checkOutTime: true,
              address: true, stars: true, rating: true, ratingCount: true,
              officialUrl: true, voucherUrl: true, placeId: true, lat: true, lng: true,
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      milestones: {
        where: { key: "close_insurance" },
        select: { state: true, resolution: true },
      },
    },
  });

  if (!trip) return null;
  // תיק סגור כבר לא מציג כלום: הקישור מפסיק לעבוד מעצמו.
  if (trip.status === "closed") return null;

  const phase: TripPhase =
    now >= trip.returnAt || trip.status === "returned" ? "returned"
    : now >= trip.departureAt || trip.status === "traveling" ? "traveling"
    : "before";
  const traveling = phase === "traveling";

  const flights: PublicFlight[] = trip.components
    .filter((c) => c.flight && c.status !== "cancelled")
    .map((c) => {
      const f = c.flight!;
      const tz = f.departsTz;
      return {
        direction: f.direction as "outbound" | "inbound",
        airline: airlineName(f.airlineCode),
        flightNumber: `${f.airlineCode} ${f.flightNumber}`.trim(),
        fromAirport: airportLabel(f.departsAirport),
        toAirport: airportLabel(f.arrivesAirport),
        departsLabel: formatAbsoluteHe(
          new Date(`${f.departsAtLocal}:00Z`), { withWeekday: true, withTime: false, timeZone: "UTC" },
        ),
        departsTime: f.departsAtLocal.slice(11, 16),
        arrivesTime: f.arrivesAtLocal ? f.arrivesAtLocal.slice(11, 16) : null,
        reference: c.reference,
        baggage: f.baggageAllowance,
        checkinOpensAt: f.checkinOpensAt,
        checkinOpensLabel: f.checkinOpensAt
          ? `${formatAbsoluteHe(f.checkinOpensAt, { withTime: false, timeZone: tz })}, ${utcToZoned(f.checkinOpensAt, tz).slice(11, 16)}`
          : null,
        checkinClosesLabel: f.checkinClosesAt
          ? `${formatAbsoluteHe(f.checkinClosesAt, { withTime: false, timeZone: tz })}, ${utcToZoned(f.checkinClosesAt, tz).slice(11, 16)}`
          : null,
        checkinDone: f.checkinDone,
        lateCheckinCosts: checkinRule(f.airlineCode).rule.late_checkin_fee,
      };
    });

  // המלון מקבל אזור משלו, ולכן הוא יורד מרשימת "מה כבר סגור".
  const booked: PublicBooked[] = trip.components
    .filter((c) => c.status === "confirmed" && !c.flight && !c.stay)
    .map((c) => ({
      type: COMPONENT_TYPE_HE[c.type as ComponentType] ?? c.type,
      description: c.description ?? COMPONENT_TYPE_HE[c.type as ComponentType] ?? c.type,
      reference: c.reference,
    }));

  // ------------------------- מה נשאר מהלקוח -------------------------
  const todos: PublicTodo[] = [];
  const balance = trip.priceToClient - trip.amountPaid;

  if (balance > 0) {
    todos.push({
      kind: "balance",
      label: "יתרת תשלום",
      detail: `נותרו ${Math.round(balance).toLocaleString("he-IL")} ₪ לתשלום.`,
    });
  }

  const missingPassports = trip.travelers.filter((t) => !t.passportNumberEnc || !t.passportExpiry).length;
  if (missingPassports > 0) {
    todos.push({
      kind: "passports",
      label: "פרטי דרכון",
      detail:
        missingPassports === trip.travelers.length
          ? "צריך צילום דרכון של כל הנוסעים."
          : `חסרים פרטי דרכון של ${missingPassports} נוסעים.`,
    });
  }

  const insurance = trip.milestones[0];
  if (insurance && insurance.state !== "done" && insurance.state !== "skipped") {
    todos.push({
      kind: "insurance",
      label: "ביטוח נסיעות",
      detail: "צריך להחליט אם לסגור ביטוח דרכנו, או לעדכן אותנו שיש לכם ביטוח אחר.",
    });
  }

  for (const f of flights) {
    // משימת צ'ק-אין מוצגת ללקוח רק אחרי שהחלון באמת נפתח.
    if (f.checkinDone || !f.checkinOpensAt || f.checkinOpensAt > now) continue;
    todos.push({
      kind: "checkin",
      label: `צ'ק-אין לטיסת ${f.direction === "outbound" ? "ההלוך" : "החזור"}`,
      detail: f.checkinClosesLabel
        ? `נסגר ב${f.checkinClosesLabel}${f.lateCheckinCosts ? ". אחרי זה צ'ק-אין בשדה עולה כסף." : "."}`
        : "כדאי לעשות עכשיו.",
    });
  }

  const upsells: PublicUpsell[] = trip.components
    .filter((c) => c.isUpsell && !isComponentResolved(c.status) && c.clientResponse !== "declined")
    .map((c) => ({
      id: c.id,
      label: COMPONENT_TYPE_HE[c.type as ComponentType] ?? c.type,
      detail: c.description,
    }));

  /* ------------------------------ המלון ------------------------------ */

  const stayComponent = trip.components.find((c) => c.stay && c.status !== "cancelled");
  const nights = nightsBetween(trip.departureAt, trip.returnAt);

  const stay: PublicStay | null = stayComponent?.stay
    ? (() => {
        const st = stayComponent.stay!;
        return {
          name: st.name,
          stars: starsLabel(st.stars),
          rating: ratingLabel(st.rating, st.ratingCount),
          address: st.address,
          roomType: st.roomType,
          board: isBoardBasis(st.boardBasis) ? BOARD_BASIS_HE[st.boardBasis] : null,
          checkInLabel: formatAbsoluteHe(trip.departureAt, { withWeekday: true, withTime: false }),
          checkOutLabel: formatAbsoluteHe(trip.returnAt, { withWeekday: true, withTime: false }),
          checkInTime: st.checkInTime,
          checkOutTime: st.checkOutTime,
          nights,
          // safeExternalUrl שוב, ולא רק בשמירה: שורה במסד שנכתבה לפני
          // הוולידציה לא אמורה להגיע ללקוח.
          officialUrl: safeExternalUrl(st.officialUrl),
          voucherUrl: safeExternalUrl(st.voucherUrl),
          mapUrl: mapUrl({
            name: st.name,
            address: st.address,
            placeId: st.placeId,
            lat: st.lat,
            lng: st.lng,
            destination: trip.destination,
          }),
          photos: [],
        };
      })()
    : null;

  const coverUrl = safeExternalUrl(trip.coverImageUrl);

  return {
    code: trip.code,
    clientName: trip.client.name,
    destination: trip.destination,
    status: trip.status as TripStatus,
    phase,
    traveling,
    departureAt: trip.departureAt,
    returnAt: trip.returnAt,
    countdown: formatRelativeHe(trip.departureAt, now).text,
    departureLabel: formatAbsoluteHe(trip.departureAt, { withWeekday: true, withTime: false }),
    returnLabel: formatAbsoluteHe(trip.returnAt, { withWeekday: true, withTime: false }),
    travelerCount: trip.travelers.length,
    nights,
    cover: coverUrl ? { url: coverUrl, credit: trip.coverCredit } : null,
    stay,
    booked,
    flights,
    todos,
    upsells,
    agent: {
      name: process.env.AGENT_NAME?.trim() || "",
      phone: process.env.AGENT_EMERGENCY_PHONE?.trim() || "",
      agency: process.env.AGENCY_NAME?.trim() || "",
    },
    inbound: flights.find((f) => f.direction === "inbound") ?? null,
  };
}

export const DISPLAY_TIMEZONE = DISPLAY_TZ;
