/**
 * הכרטיס הראשי של הנסיעה.
 *
 * הסוכן פותח תיק כדי לענות על שאלה אחת — "מה המצב, ומה הדבר הבא" — ולא
 * כדי לקרוא את כל מה שהמערכת יודעת. כל מה שמופיע כאן הוא מה שנכנס לכרטיס
 * הפתיחה: תאריכים, טיסה הלוך, מלון, טיסה חזור, כסף, ומה נשאר פתוח.
 * כל השאר יורד לאזורים המתקפלים.
 *
 * הגזירה יושבת כאן ולא בתוך העמוד כדי שאפשר יהיה לבדוק אותה: "3 לילות"
 * שמוצג ללקוח חייב להיות נכון גם כשהנסיעה חוצה מעבר לשעון קיץ.
 */

import { DISPLAY_TZ, utcToZoned } from "../time/zones";

export type SummaryFlight = {
  direction: "outbound" | "inbound";
  airlineCode: string;
  flightNumber: string;
  fromAirport: string;
  toAirport: string;
  /** "YYYY-MM-DD" ו-"HH:MM" בשעון המקומי של שדה היציאה. */
  date: string;
  time: string;
  /** null כשהשעה עוד לא ידועה — לא ממציאים אותה. */
  arrivesTime: string | null;
  baggage: string | null;
  checkinDone: boolean;
};

export type SummaryStay = {
  name: string;
  detail: string | null;
  confirmed: boolean;
};

export type TripSummary = {
  nights: number;
  days: number;
  outbound: SummaryFlight | null;
  inbound: SummaryFlight | null;
  stay: SummaryStay | null;
  money: {
    price: number;
    paid: number;
    balance: number;
    /** שולם במלואו, חלקית, או בכלל לא. */
    status: "unpaid" | "partial" | "paid";
  };
  components: { total: number; confirmed: number };
};

type ComponentLike = {
  type: string;
  status: string;
  supplier: string | null;
  description: string | null;
  flight: {
    direction: string;
    airlineCode: string;
    flightNumber: string;
    departsAtLocal: string;
    departsAirport: string;
    arrivesAtLocal: string | null;
    arrivesAirport: string;
    baggageAllowance: string | null;
    checkinDone: boolean;
  } | null;
};

/**
 * מספר הלילות. נספר בימי לוח בשעון ישראל ולא בהפרש שעות: נסיעה שיוצאת
 * בשש בערב וחוזרת בשמונה בבוקר שלושה ימים אחר כך היא שלושה לילות, גם
 * כשההפרש בשעות הוא 62 ולא 72.
 */
export function nightsBetween(departureAt: Date, returnAt: Date, tz = DISPLAY_TZ): number {
  const day = (d: Date) => Date.parse(`${utcToZoned(d, tz).slice(0, 10)}T00:00:00Z`);
  return Math.max(0, Math.round((day(returnAt) - day(departureAt)) / 86_400_000));
}

function toFlight(c: ComponentLike): SummaryFlight | null {
  const f = c.flight;
  if (!f) return null;
  return {
    direction: f.direction === "inbound" ? "inbound" : "outbound",
    airlineCode: f.airlineCode,
    flightNumber: f.flightNumber,
    fromAirport: f.departsAirport,
    toAirport: f.arrivesAirport,
    date: f.departsAtLocal.slice(0, 10),
    time: f.departsAtLocal.slice(11, 16),
    arrivesTime: f.arrivesAtLocal ? f.arrivesAtLocal.slice(11, 16) : null,
    baggage: f.baggageAllowance,
    checkinDone: f.checkinDone,
  };
}

const RESOLVED = new Set(["confirmed", "cancelled", "declined_by_client"]);

export function summarizeTrip(trip: {
  departureAt: Date;
  returnAt: Date;
  priceToClient: number;
  amountPaid: number;
  components: ComponentLike[];
}): TripSummary {
  const nights = nightsBetween(trip.departureAt, trip.returnAt);

  const flights = trip.components.filter((c) => c.flight);
  const outbound = flights.map(toFlight).find((f) => f?.direction === "outbound") ?? null;
  const inbound = flights.map(toFlight).find((f) => f?.direction === "inbound") ?? null;

  const hotel = trip.components.find((c) => c.type === "hotel" && c.status !== "cancelled");
  const stay: SummaryStay | null = hotel
    ? {
        name: hotel.supplier || hotel.description || "מלון",
        detail: hotel.supplier && hotel.description ? hotel.description : null,
        confirmed: hotel.status === "confirmed",
      }
    : null;

  const balance = Math.max(0, trip.priceToClient - trip.amountPaid);

  return {
    nights,
    // "3 לילות" הם ארבעה ימים. הסוכן משתמש בשניהם, ובלבול ביניהם הוא
    // טעות שמגיעה עד ללקוח.
    days: nights + 1,
    outbound,
    inbound,
    stay,
    money: {
      price: trip.priceToClient,
      paid: trip.amountPaid,
      balance,
      status:
        trip.priceToClient > 0 && balance === 0 ? "paid" : trip.amountPaid > 0 ? "partial" : "unpaid",
    },
    components: {
      total: trip.components.length,
      confirmed: trip.components.filter((c) => RESOLVED.has(c.status)).length,
    },
  };
}

export const PAYMENT_STATUS_HE: Record<TripSummary["money"]["status"], string> = {
  unpaid: "לא שולם",
  partial: "שולם חלקית",
  paid: "שולם במלואו",
};
