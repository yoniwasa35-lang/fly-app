"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { changeDeparture } from "@/lib/trips/service";
import { syncTrip } from "@/lib/milestones/sync";
import { COMPONENT_TYPES } from "@/lib/domain/types";
import { DISPLAY_TZ, zonedToUtc } from "@/lib/time/zones";
import type { AnchorChangeSummary } from "@/lib/milestones/reconcile";

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
