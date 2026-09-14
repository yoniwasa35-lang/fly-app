"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { duplicateTrip } from "@/lib/trips/service";

const schema = z.object({
  sourceTripId: z.string().trim().min(1),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "צריך תאריך יציאה"),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "צריך תאריך חזרה"),
  copyTravelers: z.string().optional(),
});

export type DuplicateState = { error?: string };

export async function duplicateTripAction(
  _prev: DuplicateState,
  formData: FormData,
): Promise<DuplicateState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "חסרים פרטים" };

  const { sourceTripId, departureDate, returnDate, copyTravelers } = parsed.data;

  if (returnDate <= departureDate) {
    return { error: "תאריך החזרה חייב להיות אחרי תאריך היציאה" };
  }

  try {
    const created = await duplicateTrip({
      sourceTripId,
      departureDate,
      returnDate,
      copyTravelers: !!copyTravelers,
    });
    redirect(`/trips/${created.id}?created=1&copied=${created.copiedTravelers}`);
  } catch (e) {
    // redirect זורק בפנים — לא לבלוע אותו כאילו היה תקלה.
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { error: e instanceof Error ? e.message : "השכפול נכשל" };
  }
}
