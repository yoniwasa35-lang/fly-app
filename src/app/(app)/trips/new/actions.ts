"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createTrip } from "@/lib/trips/service";
import { isKnownAirport } from "@/lib/time/airports";
import { DISPLAY_TZ, zonedToUtc } from "@/lib/time/zones";

const schema = z.object({
  clientName: z.string().trim().min(2, "צריך שם לקוח"),
  clientPhone: z.string().trim().min(6, "צריך טלפון — זה ערוץ התקשורת"),
  destination: z.string().trim().min(2, "צריך יעד"),
  templateId: z.string().trim().min(1),
  departureAirport: z.string().trim().length(3, "קוד שדה בן 3 אותיות"),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך יציאה חסר"),
  departureTime: z.string().regex(/^\d{2}:\d{2}$/, "שעת יציאה חסרה"),
  returnAirport: z.string().trim().length(3, "קוד שדה בן 3 אותיות"),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך חזרה חסר"),
  returnTime: z.string().regex(/^\d{2}:\d{2}$/, "שעת חזרה חסרה"),
  outboundAirline: z.string().trim().optional(),
  outboundFlightNumber: z.string().trim().optional(),
  inboundAirline: z.string().trim().optional(),
  inboundFlightNumber: z.string().trim().optional(),
  bookedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  priceToClient: z.coerce.number().min(0).default(0),
  amountPaid: z.coerce.number().min(0).default(0),
  supplierCost: z.coerce.number().min(0).default(0),
  source: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type NewTripState = { error?: string; warning?: string };

export async function createTripAction(
  _prev: NewTripState,
  formData: FormData,
): Promise<NewTripState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(" · ") };
  }
  const v = parsed.data;

  // שדה שלא מוכר יגרור הנחת אזור זמן שגויה. עוצרים ולא ממציאים.
  for (const [label, code] of [["היציאה", v.departureAirport], ["החזרה", v.returnAirport]] as const) {
    if (!isKnownAirport(code)) {
      return {
        error: `שדה ${label} "${code.toUpperCase()}" לא מוכר למערכת, ולכן אזור הזמן שלו לא ידוע. הוסיפו אותו ל-config/data/airports.json.`,
      };
    }
  }

  let created: { id: string };
  try {
    created = await createTrip({
      client: { name: v.clientName, phone: v.clientPhone },
      destination: v.destination,
      templateId: v.templateId,
      departureLocal: `${v.departureDate}T${v.departureTime}`,
      departureAirport: v.departureAirport,
      returnLocal: `${v.returnDate}T${v.returnTime}`,
      returnAirport: v.returnAirport,
      outboundAirline: v.outboundAirline || null,
      outboundFlightNumber: v.outboundFlightNumber || null,
      inboundAirline: v.inboundAirline || null,
      inboundFlightNumber: v.inboundFlightNumber || null,
      bookedAt: v.bookedDate ? zonedToUtc(`${v.bookedDate}T12:00`, DISPLAY_TZ) : undefined,
      travelers: [],
      priceToClient: v.priceToClient,
      amountPaid: v.amountPaid,
      supplierCost: v.supplierCost,
      source: v.source || null,
      notes: v.notes || null,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "יצירת התיק נכשלה" };
  }

  redirect(`/trips/${created.id}?created=1`);
}
