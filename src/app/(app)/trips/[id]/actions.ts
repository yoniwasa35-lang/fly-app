"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { changeDeparture, closeTrip, updateClient, updateTripDetails } from "@/lib/trips/service";
import { saveFlight } from "@/lib/trips/flights";
import { syncTrip } from "@/lib/milestones/sync";
import { COMPONENT_TYPES } from "@/lib/domain/types";
import { DISPLAY_TZ, zonedToUtc } from "@/lib/time/zones";
import type { AnchorChangeSummary } from "@/lib/milestones/reconcile";
import { FLIGHT_LABEL } from "@/lib/trips/flightLabels";

export type MoveSummary = {
  movedCount: number;
  createdCount: number;
  removedCount: number;
  frozenCount: number;
  moves: Array<{ title: string; from: string; to: string; deltaMinutes: number }>;
};

export type ChangeDepartureState = { error?: string; summary?: MoveSummary };

const departureSchema = z.object({
  tripId: z.string().min(1),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departureTime: z.string().regex(/^\d{2}:\d{2}$/),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnTime: z.string().regex(/^\d{2}:\d{2}$/),
});

function toDisplay(summary: AnchorChangeSummary): MoveSummary {
  return {
    movedCount: summary.movedCount,
    createdCount: summary.createdCount,
    removedCount: summary.removedCount,
    frozenCount: summary.frozenCount,
    moves: summary.moves.map((m) => ({
      title: m.title,
      from: m.from.toISOString(),
      to: m.to.toISOString(),
      deltaMinutes: m.deltaMinutes,
    })),
  };
}

/** סעיף 6.5 — שינוי עוגן מחזיר סיכום מה זז ולאן, ולא משנה בשקט. */
export async function changeDepartureAction(
  _prev: ChangeDepartureState,
  formData: FormData,
): Promise<ChangeDepartureState> {
  const parsed = departureSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "תאריכים לא תקינים" };
  const v = parsed.data;

  try {
    const summary = await changeDeparture(v.tripId, {
      departureLocal: `${v.departureDate}T${v.departureTime}`,
      returnLocal: `${v.returnDate}T${v.returnTime}`,
    });
    revalidatePath("/", "layout");
    return { summary: toDisplay(summary) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "עדכון התאריך נכשל" };
  }
}

const componentSchema = z.object({
  tripId: z.string().min(1),
  type: z.enum(COMPONENT_TYPES),
  supplier: z.string().trim().optional(),
  description: z.string().trim().optional(),
  reference: z.string().trim().optional(),
  freeCancelUntil: z.string().optional(),
  supplierPaymentDue: z.string().optional(),
  cost: z.coerce.number().min(0).default(0),
  price: z.coerce.number().min(0).default(0),
  isUpsell: z.string().optional(),
});


export type AddComponentState = { error?: string; ok?: boolean };

export async function addComponentAction(
  _prev: AddComponentState,
  formData: FormData,
): Promise<AddComponentState> {
  const parsed = componentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ") };
  }
  const v = parsed.data;

  try {
    const last = await prisma.component.findFirst({
      where: { tripId: v.tripId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    await prisma.component.create({
      data: {
        tripId: v.tripId,
        type: v.type,
        supplier: v.supplier || null,
        description: v.description || null,
        reference: v.reference || null,
        status: "requested",
        // דדליינים נקלטים כתאריך בשעון ישראל; שעת ברירת המחדל היא סוף היום,
        // כי "ביטול חינם עד ה-27" פירושו עד סוף אותו יום.
        freeCancelUntil: v.freeCancelUntil ? zonedToUtc(`${v.freeCancelUntil}T23:59`, DISPLAY_TZ) : null,
        supplierPaymentDue: v.supplierPaymentDue ? zonedToUtc(`${v.supplierPaymentDue}T12:00`, DISPLAY_TZ) : null,
        cost: v.cost,
        price: v.price,
        isUpsell: v.isUpsell === "on",
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });

    await syncTrip(v.tripId);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "הוספת הרכיב נכשלה" };
  }
}

export async function deleteComponentAction(componentId: string): Promise<{ error?: string }> {
  try {
    const c = await prisma.component.delete({ where: { id: componentId }, select: { tripId: true } });
    await syncTrip(c.tripId);
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "מחיקת הרכיב נכשלה" };
  }
}

const editSchema = z.object({
  componentId: z.string().min(1),
  supplier: z.string().trim().optional(),
  description: z.string().trim().optional(),
  reference: z.string().trim().optional(),
  freeCancelUntil: z.string().optional(),
  supplierPaymentDue: z.string().optional(),
  cost: z.coerce.number().min(0).optional(),
  price: z.coerce.number().min(0).optional(),
});

export type EditComponentState = { error?: string; ok?: boolean };

/**
 * עריכת רכיב קיים. בלי זה אי אפשר היה להזין מספר הזמנה אחרי הפתיחה, והוא
 * הדבר שהלקוח מחפש בעמוד שלו כשהוא עומד בדלפק.
 */
export async function editComponentAction(
  _prev: EditComponentState,
  formData: FormData,
): Promise<EditComponentState> {
  const parsed = editSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ") };
  }
  const v = parsed.data;

  try {
    const updated = await prisma.component.update({
      where: { id: v.componentId },
      data: {
        supplier: v.supplier || null,
        description: v.description || null,
        reference: v.reference || null,
        freeCancelUntil: v.freeCancelUntil ? zonedToUtc(`${v.freeCancelUntil}T23:59`, DISPLAY_TZ) : null,
        supplierPaymentDue: v.supplierPaymentDue ? zonedToUtc(`${v.supplierPaymentDue}T12:00`, DISPLAY_TZ) : null,
        ...(v.cost !== undefined ? { cost: v.cost } : {}),
        ...(v.price !== undefined ? { price: v.price } : {}),
      },
      select: { tripId: true },
    });

    // שינוי מועד ביטול או תשלום מזיז את אבני הדרך שנגזרות ממנו.
    await syncTrip(updated.tripId);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "עדכון הרכיב נכשל" };
  }
}

// ------------------------------- טיסות --------------------------------

const flightSchema = z.object({
  componentId: z.string().min(1),
  direction: z.enum(["outbound", "inbound"]),
  airlineCode: z.string().trim().min(1),
  flightNumber: z.string().trim(),
  departsAirport: z.string().trim().length(3),
  departsDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departsTime: z.string().regex(/^\d{2}:\d{2}$/),
  arrivesAirport: z.string().trim().length(3),
  arrivesDate: z.string().optional(),
  arrivesTime: z.string().optional(),
  baggageAllowance: z.string().trim().optional(),
});

export type FlightFormState = { error?: string; ok?: boolean };

export async function saveFlightAction(
  _prev: FlightFormState,
  formData: FormData,
): Promise<FlightFormState> {
  const parsed = flightSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "חסרים פרטי טיסה: " + parsed.error.issues.map((i) => i.path.join(".")).join(", ") };
  }
  const { componentId, ...flight } = parsed.data;
  try {
    await saveFlight(componentId, flight);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שמירת הטיסה נכשלה" };
  }
}

/** יוצר רכיב טיסה ריק, שאותו ממלאים מיד בטופס. */
export async function addFlightComponentAction(
  tripId: string,
  direction: "outbound" | "inbound",
): Promise<{ error?: string; componentId?: string }> {
  try {
    const last = await prisma.component.findFirst({
      where: { tripId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true },
    });
    const c = await prisma.component.create({
      data: {
        tripId, type: "flight", status: "requested",
        description: FLIGHT_LABEL[direction],
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    revalidatePath("/", "layout");
    return { componentId: c.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "יצירת הטיסה נכשלה" };
  }
}

// --------------------------- פרטי לקוח ותיק ---------------------------

const detailsSchema = z.object({
  tripId: z.string().min(1),
  clientName: z.string().trim().min(2),
  clientPhone: z.string().trim().min(6),
  clientEmail: z.string().trim().optional(),
  destination: z.string().trim().min(2),
  source: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type DetailsState = { error?: string; ok?: boolean };

export async function updateDetailsAction(
  _prev: DetailsState,
  formData: FormData,
): Promise<DetailsState> {
  const parsed = detailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(" · ") };
  }
  const v = parsed.data;
  try {
    await updateClient(v.tripId, { name: v.clientName, phone: v.clientPhone, email: v.clientEmail });
    await updateTripDetails(v.tripId, { destination: v.destination, source: v.source, notes: v.notes });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "העדכון נכשל" };
  }
}

/**
 * סגירת תיק. מוחקת את מספרי הדרכון — דרישת סעיף 10. עד עכשיו הפונקציה
 * הייתה קיימת בשירות בלי שום דרך להפעיל אותה, כלומר הנתונים לא נמחקו לעולם.
 */
export async function closeTripAction(tripId: string): Promise<{ error?: string; ok?: boolean }> {
  try {
    await closeTrip(tripId);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "סגירת התיק נכשלה" };
  }
}

/**
 * יוצר רכיב מלון ואת פרטי השהייה שלו בבת אחת.
 *
 * עד עכשיו היה צריך להוסיף רכיב מסוג מלון במסך אחד ואז למלא את פרטיו
 * במסך אחר. שני שלבים לפעולה אחת הם בדיוק המקום שבו מישהו מוותר.
 */
export async function addHotelAction(
  tripId: string,
  name: string,
): Promise<{ error?: string; componentId?: string }> {
  const clean = name.trim();
  if (clean.length < 2) return { error: "צריך שם מלון" };

  try {
    const last = await prisma.component.findFirst({
      where: { tripId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true },
    });

    const c = await prisma.component.create({
      data: {
        tripId,
        type: "hotel",
        status: "requested",
        supplier: clean,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        stay: { create: { name: clean } },
      },
      select: { id: true },
    });

    await syncTrip(tripId);
    revalidatePath("/", "layout");
    return { componentId: c.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "הוספת המלון נכשלה" };
  }
}
