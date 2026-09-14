/**
 * הזנה ועריכה של פרטי טיסה אחרי פתיחת התיק.
 *
 * בפתיחת התיק חברת התעופה לרוב עדיין לא ידועה — ההזמנה יצאה ומחכים
 * לאסמכתא. בלי המסך הזה טיסה שלא הוזנה ברגע הראשון לא יכלה להיכנס לעולם,
 * וחלונות הצ'ק-אין נגזרים ממנה: זה בדיוק הכשל השלישי בסעיף 2.
 */

import { prisma } from "../db";
import { checkinWindow } from "../airlines/checkin";
import { airportTz, isKnownAirport } from "../time/airports";
import { zonedToUtc } from "../time/zones";
import { syncTrip } from "../milestones/sync";

export type FlightInput = {
  direction: "outbound" | "inbound";
  airlineCode: string;
  flightNumber: string;
  departsAirport: string;
  /** "YYYY-MM-DD" */
  departsDate: string;
  /** "HH:mm" בשעון שדה היציאה */
  departsTime: string;
  arrivesAirport: string;
  /** אופציונלי. ריק = לא ידוע, ולא מוצג ללקוח. */
  arrivesDate?: string | null;
  arrivesTime?: string | null;
  baggageAllowance?: string | null;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

function validate(input: FlightInput) {
  const from = input.departsAirport.trim().toUpperCase();
  const to = input.arrivesAirport.trim().toUpperCase();

  for (const [label, code] of [["היציאה", from], ["הנחיתה", to]] as const) {
    if (!isKnownAirport(code)) {
      throw new Error(
        `שדה ${label} "${code}" לא מוכר למערכת, ולכן אזור הזמן שלו לא ידוע. הוסיפו אותו ל-config/data/airports.json.`,
      );
    }
  }
  if (!DATE.test(input.departsDate) || !TIME.test(input.departsTime)) {
    throw new Error("תאריך או שעת ההמראה אינם תקינים");
  }
  if (!input.airlineCode.trim()) throw new Error("צריך לבחור חברת תעופה");

  const departsAtLocal = `${input.departsDate}T${input.departsTime}`;
  const departsTz = airportTz(from).tz;

  // שעת נחיתה בלי תאריך מניחה את אותו יום. אם הטיסה נוחתת למחרת, הסוכן
  // יבחר תאריך במפורש — עדיף לא לנחש נתון שמוצג ללקוח.
  const arrivesTime = input.arrivesTime?.trim();
  const arrivesDate = input.arrivesDate?.trim() || input.departsDate;
  const arrivesAtLocal = arrivesTime && TIME.test(arrivesTime) ? `${arrivesDate}T${arrivesTime}` : null;
  const arrivesTz = airportTz(to).tz;

  if (arrivesAtLocal && zonedToUtc(arrivesAtLocal, arrivesTz) <= zonedToUtc(departsAtLocal, departsTz)) {
    throw new Error("שעת הנחיתה לא יכולה להיות לפני ההמראה. אם הטיסה נוחתת למחרת, בחרו את תאריך הנחיתה.");
  }

  return { from, to, departsAtLocal, departsTz, arrivesAtLocal, arrivesTz };
}

export async function saveFlight(componentId: string, input: FlightInput): Promise<void> {
  const v = validate(input);
  const airlineCode = input.airlineCode.trim().toUpperCase();
  const flightNumber = input.flightNumber.trim();

  const win = checkinWindow({
    airlineCode,
    departsAtLocal: v.departsAtLocal,
    departsTz: v.departsTz,
  });

  const component = await prisma.component.findUniqueOrThrow({
    where: { id: componentId },
    select: { tripId: true, description: true, flight: { select: { componentId: true, checkinOverridden: true, checkinDone: true } } },
  });

  const data = {
    airlineCode,
    flightNumber,
    direction: input.direction,
    departsAtLocal: v.departsAtLocal,
    departsTz: v.departsTz,
    departsAirport: v.from,
    departsAtUtc: zonedToUtc(v.departsAtLocal, v.departsTz),
    arrivesAtLocal: v.arrivesAtLocal,
    arrivesTz: v.arrivesTz,
    arrivesAirport: v.to,
    arrivesAtUtc: v.arrivesAtLocal ? zonedToUtc(v.arrivesAtLocal, v.arrivesTz) : null,
    baggageAllowance: input.baggageAllowance?.trim() || null,
  };

  if (component.flight) {
    await prisma.flight.update({
      where: { componentId },
      data: {
        ...data,
        // דריסה ידנית של חלון הצ'ק-אין נשמרת; אחרת הוא מחושב מחדש.
        ...(component.flight.checkinOverridden
          ? {}
          : { checkinOpensAt: win.opensAt, checkinClosesAt: win.closesAt }),
      },
    });
  } else {
    await prisma.flight.create({
      data: { componentId, ...data, checkinOpensAt: win.opensAt, checkinClosesAt: win.closesAt },
    });
  }

  const label = `טיסה ${input.direction === "outbound" ? "הלוך" : "חזור"} ${airlineCode}${flightNumber}`;
  await prisma.component.update({
    where: { id: componentId },
    data: {
      type: "flight",
      supplier: airlineCode,
      // תיאור ידני שהסוכן כתב נשמר; תיאור אוטומטי מתעדכן.
      ...(component.description && !component.description.startsWith("טיסה ") ? {} : { description: label }),
    },
  });

  // חלונות הצ'ק-אין השתנו, ולכן אבני הדרך שנגזרות מהם.
  await syncTrip(component.tripId);
}
