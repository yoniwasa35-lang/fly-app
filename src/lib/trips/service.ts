/**
 * פעולות על תיקים. כל פעולה שמשנה עוגן, רכיב, נוסע או תשלום מסתיימת
 * בקריאה ל-syncTrip, כדי שאבני הדרך תמיד ישקפו את מצב התיק.
 */

import { prisma } from "../db";
import { checkinWindow } from "../airlines/checkin";
import { encryptPassport, passportLast4 } from "../crypto/passport";
import { airportTz } from "../time/airports";
import { DISPLAY_TZ, utcToZoned, zonedToUtc } from "../time/zones";
import { refreshTripStates, syncTrip } from "../milestones/sync";
import type { AnchorChangeSummary } from "../milestones/reconcile";

export type NewTripInput = {
  client: { name: string; phone: string; email?: string | null };
  destination: string;
  templateId: string;
  departureLocal: string;
  departureAirport: string;
  returnLocal: string;
  returnAirport: string;
  /** אופציונלי. בלי זה התיק נוצר בלי טיסות ואבני הדרך של הצ'ק-אין ייווצרו מאוחר יותר. */
  outboundAirline?: string | null;
  outboundFlightNumber?: string | null;
  inboundAirline?: string | null;
  inboundFlightNumber?: string | null;
  /**
   * מתי שולם. התיק נולד ברגע התשלום (סעיף 5), ולא ברגע ההקלדה — ההבדל
   * קריטי כשמזינים תיקים קיימים, שכולם שולמו לפני שבועות.
   */
  bookedAt?: Date;
  travelers: Array<{
    firstNameLatin: string;
    lastNameLatin: string;
    displayNameHe?: string | null;
    passportNumber?: string | null;
    passportExpiry?: string | null;
    passportCountry?: string | null;
    phone?: string | null;
    isLead?: boolean;
  }>;
  priceToClient?: number;
  supplierCost?: number;
  amountPaid?: number;
  source?: string | null;
  notes?: string | null;
};

/** מספר תיק לתצוגה: חודש-שנה של היציאה, ומונה רץ. */
export async function nextTripCode(departureAt: Date): Promise<string> {
  const local = utcToZoned(departureAt, DISPLAY_TZ);
  const prefix = `${local.slice(2, 4)}${local.slice(5, 7)}`;
  const last = await prisma.trip.findFirst({
    where: { code: { startsWith: `${prefix}-` } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const n = last ? Number(last.code.split("-")[1]) + 1 : 101;
  return `${prefix}-${n}`;
}

export async function createTrip(input: NewTripInput): Promise<{ id: string; code: string }> {
  const depTz = airportTz(input.departureAirport).tz;
  const retTz = airportTz(input.returnAirport).tz;
  const departureAt = zonedToUtc(input.departureLocal, depTz);
  const returnAt = zonedToUtc(input.returnLocal, retTz);

  if (returnAt.getTime() <= departureAt.getTime()) {
    throw new Error("מועד החזרה חייב להיות אחרי מועד היציאה");
  }

  const bookedAt = input.bookedAt ?? new Date();
  if (bookedAt.getTime() > Date.now() + 60_000) {
    throw new Error("תאריך התשלום לא יכול להיות בעתיד");
  }
  if (bookedAt.getTime() > departureAt.getTime()) {
    throw new Error("תאריך התשלום לא יכול להיות אחרי היציאה");
  }

  const code = await nextTripCode(departureAt);

  const trip = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: { name: input.client.name, phone: input.client.phone, email: input.client.email ?? null },
    });

    const created = await tx.trip.create({
      data: {
        code,
        clientId: client.id,
        destination: input.destination,
        templateId: input.templateId,
        departureAt,
        departureLocal: input.departureLocal,
        departureTz: depTz,
        departureAirport: input.departureAirport.toUpperCase(),
        returnAt,
        returnLocal: input.returnLocal,
        returnTz: retTz,
        returnAirport: input.returnAirport.toUpperCase(),
        bookedAt,
        status: "active",
        priceToClient: input.priceToClient ?? 0,
        supplierCost: input.supplierCost ?? 0,
        amountPaid: input.amountPaid ?? 0,
        source: input.source ?? null,
        notes: input.notes ?? null,
      },
    });

    for (const [i, t] of input.travelers.entries()) {
      const passport = t.passportNumber?.trim();
      await tx.traveler.create({
        data: {
          tripId: created.id,
          firstNameLatin: t.firstNameLatin.trim().toUpperCase(),
          lastNameLatin: t.lastNameLatin.trim().toUpperCase(),
          displayNameHe: t.displayNameHe?.trim() || null,
          passportNumberEnc: passport ? encryptPassport(passport) : null,
          passportLast4: passport ? passportLast4(passport) : null,
          passportExpiry: t.passportExpiry ? zonedToUtc(`${t.passportExpiry}T12:00`, DISPLAY_TZ) : null,
          passportCountry: t.passportCountry?.trim() || "IL",
          phone: t.phone?.trim() || null,
          isLead: t.isLead ?? i === 0,
        },
      });
    }

    let sortOrder = 0;
    if (input.outboundAirline) {
      await createFlightComponent(tx, {
        tripId: created.id,
        sortOrder: sortOrder++,
        direction: "outbound",
        airlineCode: input.outboundAirline,
        flightNumber: input.outboundFlightNumber ?? "",
        departsAtLocal: input.departureLocal,
        departsAirport: input.departureAirport,
        arrivesAtLocal: input.departureLocal,
        arrivesAirport: input.returnAirport,
      });
    }
    if (input.inboundAirline) {
      await createFlightComponent(tx, {
        tripId: created.id,
        sortOrder: sortOrder++,
        direction: "inbound",
        airlineCode: input.inboundAirline,
        flightNumber: input.inboundFlightNumber ?? "",
        departsAtLocal: input.returnLocal,
        departsAirport: input.returnAirport,
        arrivesAtLocal: input.returnLocal,
        arrivesAirport: input.departureAirport,
      });
    }

    return created;
  });

  await syncTrip(trip.id);
  return { id: trip.id, code: trip.code };
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function createFlightComponent(
  tx: Tx,
  params: {
    tripId: string;
    sortOrder: number;
    direction: "outbound" | "inbound";
    airlineCode: string;
    flightNumber: string;
    departsAtLocal: string;
    departsAirport: string;
    arrivesAtLocal: string;
    arrivesAirport: string;
  },
) {
  const departsTz = airportTz(params.departsAirport).tz;
  const arrivesTz = airportTz(params.arrivesAirport).tz;
  const win = checkinWindow({
    airlineCode: params.airlineCode,
    departsAtLocal: params.departsAtLocal,
    departsTz,
  });

  const component = await tx.component.create({
    data: {
      tripId: params.tripId,
      type: "flight",
      supplier: params.airlineCode.toUpperCase(),
      description: `טיסה ${params.direction === "outbound" ? "הלוך" : "חזור"} ${params.airlineCode.toUpperCase()}${params.flightNumber}`,
      status: "requested",
      sortOrder: params.sortOrder,
    },
  });

  await tx.flight.create({
    data: {
      componentId: component.id,
      airlineCode: params.airlineCode.toUpperCase(),
      flightNumber: params.flightNumber,
      direction: params.direction,
      departsAtLocal: params.departsAtLocal,
      departsTz,
      departsAirport: params.departsAirport.toUpperCase(),
      departsAtUtc: zonedToUtc(params.departsAtLocal, departsTz),
      arrivesAtLocal: params.arrivesAtLocal,
      arrivesTz,
      arrivesAirport: params.arrivesAirport.toUpperCase(),
      arrivesAtUtc: zonedToUtc(params.arrivesAtLocal, arrivesTz),
      checkinOpensAt: win.opensAt,
      checkinClosesAt: win.closesAt,
    },
  });

  return component;
}

/** שינוי העוגן הראשי. מחזיר סיכום "מה זז ולאן" — סעיף 6.5. */
export async function changeDeparture(
  tripId: string,
  input: { departureLocal: string; departureAirport?: string; returnLocal: string; returnAirport?: string },
): Promise<AnchorChangeSummary> {
  const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
  const depAirport = (input.departureAirport ?? trip.departureAirport).toUpperCase();
  const retAirport = (input.returnAirport ?? trip.returnAirport).toUpperCase();
  const depTz = airportTz(depAirport).tz;
  const retTz = airportTz(retAirport).tz;

  const departureAt = zonedToUtc(input.departureLocal, depTz);
  const returnAt = zonedToUtc(input.returnLocal, retTz);
  if (returnAt.getTime() <= departureAt.getTime()) {
    throw new Error("מועד החזרה חייב להיות אחרי מועד היציאה");
  }

  await prisma.trip.update({
    where: { id: tripId },
    data: {
      departureAt, departureLocal: input.departureLocal, departureTz: depTz, departureAirport: depAirport,
      returnAt, returnLocal: input.returnLocal, returnTz: retTz, returnAirport: retAirport,
    },
  });

  // הטיסות נעות עם העוגן, אלא אם הוזנו להן שעות משלהן.
  const flights = await prisma.flight.findMany({ where: { component: { tripId } } });
  for (const f of flights) {
    const isOutbound = f.direction === "outbound";
    const local = isOutbound ? input.departureLocal : input.returnLocal;
    const tz = isOutbound ? depTz : retTz;
    await prisma.flight.update({
      where: { componentId: f.componentId },
      data: { departsAtLocal: local, departsTz: tz, departsAtUtc: zonedToUtc(local, tz) },
    });
  }

  return syncTrip(tripId);
}

export async function setComponentStatus(componentId: string, status: string): Promise<void> {
  const c = await prisma.component.update({
    where: { id: componentId },
    data: {
      status,
      declinedAt: status === "declined_by_client" ? new Date() : null,
      clientResponse: status === "declined_by_client" ? "declined" : undefined,
    },
    select: { tripId: true },
  });
  await syncTrip(c.tripId);
}

export async function markCheckinDone(componentId: string, done: boolean): Promise<void> {
  const f = await prisma.flight.update({
    where: { componentId },
    data: { checkinDone: done, checkinDoneAt: done ? new Date() : null },
    select: { component: { select: { tripId: true } } },
  });
  await refreshTripStates(f.component.tripId);
}

export async function recordPayment(tripId: string, amountPaid: number): Promise<void> {
  await prisma.trip.update({ where: { id: tripId }, data: { amountPaid } });
  await refreshTripStates(tripId);
}

/**
 * סגירת תיק מוחקת את מספרי הדרכון. תאריכי התוקף נשארים, כי הם נדרשים
 * להזמנה הבאה ואינם מזהים כשלעצמם — סעיף 10.
 */
export async function closeTrip(tripId: string): Promise<void> {
  await prisma.$transaction([
    prisma.traveler.updateMany({
      where: { tripId },
      data: { passportNumberEnc: null, passportLast4: null },
    }),
    prisma.trip.update({ where: { id: tripId }, data: { status: "closed" } }),
  ]);
}

/**
 * עדכון הסכומים בתיק. שינוי המחיר ללקוח משפיע על אבן הדרך של גביית
 * היתרה, ולכן המצבים מחושבים מחדש.
 */
export async function updateFinance(
  tripId: string,
  values: { priceToClient: number; supplierCost: number },
): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`ערך לא תקין בשדה ${key}`);
  }
  await prisma.trip.update({ where: { id: tripId }, data: values });
  await refreshTripStates(tripId);
}

/**
 * סגירת העלות בפועל — מה שמוזן באבן הדרך שנפתחת 30 יום אחרי החזרה.
 * הרווח בפועל נגזר מזה ולא מוזן בנפרד.
 */
export async function settleSupplierCost(tripId: string, actualSupplierCost: number): Promise<void> {
  if (!Number.isFinite(actualSupplierCost) || actualSupplierCost < 0) {
    throw new Error("עלות ספקים לא תקינה");
  }
  await prisma.trip.update({ where: { id: tripId }, data: { actualSupplierCost } });
  await refreshTripStates(tripId);
}
