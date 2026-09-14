/**
 * ספריית הלקוחות.
 *
 * עד עכשיו לקוח היה שדה בתוך תיק, ולא ישות שאפשר להסתכל עליה. אבל
 * הסוכן חושב באנשים לפני שהוא חושב בתיקים: "מה קורה עם משפחת כהן"
 * קודם ל"מה קורה בתיק 2609-102". המסך הזה הופך את זה לאמת גם במערכת.
 *
 * כל שאילתה כאן בוחרת שדות מפורשות. include רחב על לקוח היה גורר גם
 * את הנוסעים ואת מספרי הדרכון המוצפנים אל תוך רשימה שלא צריכה אותם.
 */

import { prisma } from "../db";
import type { TripStatus } from "../domain/types";

export type ClientRow = {
  id: string;
  name: string;
  phone: string;
  tripCount: number;
  /** הנסיעה הקרובה שעוד לא הסתיימה, אם יש. זה מה שהסוכן מחפש ברשימה. */
  next: {
    id: string;
    code: string;
    destination: string;
    departureAt: Date;
    returnAt: Date;
    status: TripStatus;
  } | null;
  /** כשאין נסיעה קרובה — לאן נסעו לאחרונה. */
  lastDestination: string | null;
};

export type ClientDirectory = {
  rows: ClientRow[];
  total: number;
  more: number;
};

const OPEN_STATUSES: TripStatus[] = ["draft", "active", "traveling"];

export async function listClients(params: {
  query?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<ClientDirectory> {
  const limit = Math.min(Math.max(params.limit ?? 40, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);
  const q = params.query?.trim();

  /*
   * חיפוש על שם או טלפון. הטלפון מנוקה מרווחים ומקפים כי אנשים מקלידים
   * אותו בכל צורה, והמספר במסד נשמר כפי שהוזן.
   */
  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { phone: { contains: q.replace(/[\s-]/g, "") } },
          { phone: { contains: q } },
        ],
      }
    : {};

  const [total, clients] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      // שובר שוויון על id: בלעדיו דפדוף על שמות זהים משכפל או מדלג.
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: offset,
      take: limit,
      select: {
        id: true,
        name: true,
        phone: true,
        _count: { select: { trips: true } },
        trips: {
          orderBy: [{ departureAt: "desc" }, { id: "desc" }],
          take: 1,
          select: { destination: true },
        },
      },
    }),
  ]);

  /*
   * הנסיעה הקרובה נשלפת בשאילתה אחת לכל הדף ולא אחת לכל לקוח: ארבעים
   * שאילתות בתוך לולאה הן בדיוק המסך שנתקע כשמספר הלקוחות גדל.
   */
  const ids = clients.map((c) => c.id);
  const upcoming = ids.length
    ? await prisma.trip.findMany({
        where: { clientId: { in: ids }, status: { in: OPEN_STATUSES } },
        orderBy: [{ departureAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          code: true,
          clientId: true,
          destination: true,
          departureAt: true,
          returnAt: true,
          status: true,
        },
      })
    : [];

  const nextByClient = new Map<string, ClientRow["next"]>();
  for (const t of upcoming) {
    if (nextByClient.has(t.clientId)) continue; // כבר מסודר לפי תאריך
    nextByClient.set(t.clientId, {
      id: t.id,
      code: t.code,
      destination: t.destination,
      departureAt: t.departureAt,
      returnAt: t.returnAt,
      status: t.status as TripStatus,
    });
  }

  return {
    rows: clients.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      tripCount: c._count.trips,
      next: nextByClient.get(c.id) ?? null,
      lastDestination: c.trips[0]?.destination ?? null,
    })),
    total,
    more: Math.max(total - (offset + clients.length), 0),
  };
}

export type ClientTrip = {
  id: string;
  code: string;
  destination: string;
  departureAt: Date;
  returnAt: Date;
  status: TripStatus;
  openMilestones: number;
};

export type ClientProfile = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  since: Date;
  trips: ClientTrip[];
  /** מי נוסע בדרך כלל, לפי הנסיעה האחרונה. בלי מספרי דרכון. */
  travelers: { name: string; nameHe: string | null; isLead: boolean }[];
};

export async function getClient(id: string): Promise<ClientProfile | null> {
  const c = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      notes: true,
      createdAt: true,
      trips: {
        orderBy: [{ departureAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          code: true,
          destination: true,
          departureAt: true,
          returnAt: true,
          status: true,
          _count: { select: { milestones: { where: { state: { in: ["due", "overdue"] } } } } },
          travelers: {
            orderBy: [{ isLead: "desc" }, { createdAt: "asc" }],
            select: { firstNameLatin: true, lastNameLatin: true, displayNameHe: true, isLead: true },
          },
        },
      },
    },
  });

  if (!c) return null;

  const latestWithTravelers = c.trips.find((t) => t.travelers.length > 0);

  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    since: c.createdAt,
    trips: c.trips.map((t) => ({
      id: t.id,
      code: t.code,
      destination: t.destination,
      departureAt: t.departureAt,
      returnAt: t.returnAt,
      status: t.status as TripStatus,
      openMilestones: t._count.milestones,
    })),
    travelers: (latestWithTravelers?.travelers ?? []).map((t) => ({
      name: `${t.firstNameLatin} ${t.lastNameLatin}`.trim(),
      nameHe: t.displayNameHe,
      isLead: t.isLead,
    })),
  };
}
