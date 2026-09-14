"use server";

import { revalidatePath } from "next/cache";
import { resetTemplate, saveTemplate } from "@/lib/messages/store";
import { renderTemplate } from "@/lib/messages/render";
import { buildVariableValues, VARIABLES, type MessageContext } from "@/lib/messages/variables";
import { checkinWindow } from "@/lib/airlines/checkin";
import { zonedToUtc } from "@/lib/time/zones";

export type TemplateActionState = { error?: string; saved?: boolean };

export async function saveTemplateAction(
  _prev: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  try {
    await saveTemplate(String(formData.get("key")), String(formData.get("body") ?? ""));
    revalidatePath("/messages");
    return { saved: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}

export async function resetTemplateAction(key: string): Promise<TemplateActionState> {
  try {
    await resetTemplate(key);
    revalidatePath("/messages");
    return { saved: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השחזור נכשל" };
  }
}

/**
 * תצוגה מקדימה מול תיק לדוגמה. מאפשרת לראות את הנוסח האמיתי, כולל שגיאות
 * כתיב במשתנים, בלי לשלוח כלום ללקוח אמיתי.
 */
export async function previewTemplateAction(body: string): Promise<{
  text: string;
  unknown: string[];
  missing: string[];
}> {
  const departsAt = "2026-08-17T21:40";
  const win = checkinWindow({ airlineCode: "A3", departsAtLocal: departsAt, departsTz: "Europe/Athens" });

  const sample: MessageContext = {
    trip: {
      code: "2608-101",
      destination: "אתונה",
      departureAt: zonedToUtc("2026-08-10T06:20", "Asia/Jerusalem"),
      departureLocal: "2026-08-10T06:20",
      departureAirport: "TLV",
      returnAt: zonedToUtc(departsAt, "Europe/Athens"),
      returnLocal: departsAt,
      priceToClient: 14200,
      amountPaid: 4000,
    },
    clientName: "משפחת לוי",
    travelerNames: ["YOSSI LEVI", "MAYA LEVI"],
    components: [{ type: "flight", status: "confirmed" }, { type: "hotel", status: "confirmed" }],
    flight: {
      airlineCode: "A3", flightNumber: "972", departsTz: "Europe/Athens",
      checkinOpensAt: win.opensAt, checkinClosesAt: win.closesAt,
    },
    now: new Date(),
  };

  const values = buildVariableValues(sample);
  // בתצוגה מקדימה ממלאים גם משתני סביבה שלא הוגדרו, עם הדוגמה מהקטלוג,
  // כדי שהסוכן יראה את מבנה ההודעה ולא רשימת שגיאות.
  for (const doc of VARIABLES) {
    if (!values[doc.name]?.trim()) values[doc.name] = doc.example;
  }

  const rendered = renderTemplate(body, values);
  return {
    text: rendered.text,
    unknown: rendered.unknown,
    missing: rendered.missing.map((m) => m.name),
  };
}
