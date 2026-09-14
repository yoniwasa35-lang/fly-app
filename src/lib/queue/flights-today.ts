/**
 * מה קורה היום בשמיים.
 *
 * זו לא משימה — אף אחד לא "מסמן בוצע" על נחיתה — אבל זה כן משהו שהסוכן
 * חייב לדעת כשהוא פותח את המסך בבוקר: מי ממריא היום ומי נוחת היום.
 * בלי זה, טיסה שהתעכבה מגיעה כטלפון מופתע מהלקוח.
 */

import { prisma } from "../db";
import { DISPLAY_TZ, endOfDayIn, startOfDayIn, utcToZoned } from "../time/zones";

export type FlightEvent = {
  id: string;
  kind: "departure" | "arrival";
  /** HH:MM בשעון ישראל. */
  time: string;
  at: Date;
  flightNumber: string;
  airport: string;
  tripId: string;
  clientName: string;
  destination: string;
};

export async function getFlightsToday(now: Date = new Date()): Promise<FlightEvent[]> {
  const from = startOfDayIn(now, DISPLAY_TZ);
  const to = endOfDayIn(now, DISPLAY_TZ);

  const window = { gte: from, lt: to };
  const select = {
    componentId: true,
    airlineCode: true,
    flightNumber: true,
    departsAtUtc: true,
    departsAirport: true,
    arrivesAtUtc: true,
    arrivesAirport: true,
    component: {
      select: {
        trip: {
          select: {
            id: true,
            destination: true,
            status: true,
            client: { select: { name: true } },
          },
        },
      },
    },
  };

  const live = { component: { trip: { status: { in: ["active", "traveling"] } } } };

  const [departing, arriving] = await Promise.all([
    prisma.flight.findMany({ where: { ...live, departsAtUtc: window }, select }),
    prisma.flight.findMany({ where: { ...live, arrivesAtUtc: window }, select }),
  ]);

  const events: FlightEvent[] = [];

  for (const f of departing) {
    events.push({
      id: `${f.componentId}:out`,
      kind: "departure",
      time: utcToZoned(f.departsAtUtc, DISPLAY_TZ).slice(11, 16),
      at: f.departsAtUtc,
      flightNumber: `${f.airlineCode} ${f.flightNumber}`,
      airport: f.departsAirport,
      tripId: f.component.trip.id,
      clientName: f.component.trip.client.name,
      destination: f.component.trip.destination,
    });
  }

  for (const f of arriving) {
    // שעת נחיתה היא nullable בכוונה — אין להמציא אותה משעת ההמראה.
    if (!f.arrivesAtUtc) continue;
    events.push({
      id: `${f.componentId}:in`,
      kind: "arrival",
      time: utcToZoned(f.arrivesAtUtc, DISPLAY_TZ).slice(11, 16),
      at: f.arrivesAtUtc,
      flightNumber: `${f.airlineCode} ${f.flightNumber}`,
      airport: f.arrivesAirport,
      tripId: f.component.trip.id,
      clientName: f.component.trip.client.name,
      destination: f.component.trip.destination,
    });
  }

  return events.sort((a, b) => a.at.getTime() - b.at.getTime() || a.id.localeCompare(b.id));
}
