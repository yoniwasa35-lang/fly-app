/**
 * הכנת הודעה לאבן דרך אחת: איזו תבנית, אילו ערכים, ואיזה קישור wa.me.
 */

import { prisma } from "../db";
import { renderTemplate } from "./render";
import { getTemplate } from "./store";
import { buildVariableValues, type MessageContext } from "./variables";
import { publicTripUrl } from "../trips/publicToken";
import { normalizePhone } from "./phone";
import { whatsAppLink } from "./whatsapp";

export type PreparedMessage = {
  milestoneId: string;
  milestoneTitle: string;
  templateKey: string;
  clientName: string;
  phoneDisplay: string | null;
  /** מספר מנורמל, כדי שהדפדפן יוכל לבנות מחדש את הקישור אחרי עריכת הטקסט. */
  phoneE164: string | null;
  text: string;
  missing: Array<{ name: string; envVar?: string }>;
  unknown: string[];
  waUrl: string | null;
  waError: string | null;
};

/**
 * הכנת הודעה לפי תיק ותבנית, בלי אבן דרך.
 *
 * זה מה שמפעיל את "שליחת הודעה ללקוח" מכרטיס הנסיעה: הסוכן בוחר נוסח
 * מתוך רשימה — "תזכורת לטיסה", "מסמכי נסיעה" — ומקבל אותו מוכן. אותו
 * עיבוד בדיוק כמו בהודעה שנולדת מאבן דרך, רק בלי אבן הדרך.
 */
export async function prepareTripMessage(
  tripId: string,
  templateKey: string,
  opts: { overrideText?: string; now?: Date; direction?: "outbound" | "inbound" } = {},
): Promise<PreparedMessage> {
  return build({ tripId, templateKey, title: null, milestoneId: null, ...opts });
}

export async function prepareMessage(
  milestoneId: string,
  opts: { overrideText?: string; now?: Date } = {},
): Promise<PreparedMessage> {
  // רק מה שצריך כדי לבחור תבנית וכיוון. את התיק עצמו טוען build.
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: { tripId: true, title: true, anchor: true, messageTemplateKey: true },
  });
  if (!milestone) throw new Error("אבן הדרך לא נמצאה");
  if (!milestone.messageTemplateKey) {
    throw new Error(`לאבן הדרך "${milestone.title}" אין תבנית הודעה — היא פנימית.`);
  }

  return build({
    tripId: milestone.tripId,
    templateKey: milestone.messageTemplateKey,
    title: milestone.title,
    milestoneId,
    // אבן דרך שעוגנה בטיסת החזור מדברת על טיסת החזור. כל השאר על ההלוך.
    direction: milestone.anchor === "flight_inbound" ? "inbound" : "outbound",
    ...opts,
  });
}

/** הליבה המשותפת. שני המסלולים נבדלים רק במי בחר את התבנית. */
async function build(args: {
  tripId: string;
  templateKey: string;
  title: string | null;
  milestoneId: string | null;
  overrideText?: string;
  now?: Date;
  direction?: "outbound" | "inbound";
}): Promise<PreparedMessage> {
  const trip = await prisma.trip.findUnique({
    where: { id: args.tripId },
    include: {
      client: true,
      travelers: { orderBy: { isLead: "desc" } },
      components: { include: { flight: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!trip) throw new Error("הנסיעה לא נמצאה");

  const direction = args.direction ?? "outbound";
  const flightComponent =
    trip.components.find((c) => c.flight?.direction === direction && c.status !== "cancelled") ??
    trip.components.find((c) => c.flight && c.status !== "cancelled");

  const context: MessageContext = {
    publicUrl: publicTripUrl(trip.publicToken),
    trip: {
      code: trip.code,
      destination: trip.destination,
      departureAt: trip.departureAt,
      departureLocal: trip.departureLocal,
      departureAirport: trip.departureAirport,
      returnAt: trip.returnAt,
      returnLocal: trip.returnLocal,
      priceToClient: trip.priceToClient,
      amountPaid: trip.amountPaid,
    },
    clientName: trip.client.name,
    travelerNames: trip.travelers.map((t) => `${t.firstNameLatin} ${t.lastNameLatin}`.trim()),
    components: trip.components.map((c) => ({ type: c.type, status: c.status })),
    flight: flightComponent?.flight
      ? {
          airlineCode: flightComponent.flight.airlineCode,
          flightNumber: flightComponent.flight.flightNumber,
          departsTz: flightComponent.flight.departsTz,
          checkinOpensAt: flightComponent.flight.checkinOpensAt,
          checkinClosesAt: flightComponent.flight.checkinClosesAt,
        }
      : null,
    now: args.now ?? new Date(),
  };

  const template = await getTemplate(args.templateKey);
  const rendered = args.overrideText
    ? { text: args.overrideText, missing: [], unknown: [] }
    : renderTemplate(template.body, buildVariableValues(context));

  const lead = trip.travelers.find((t) => t.isLead && t.phone?.trim());
  const phone = lead?.phone?.trim() || trip.client.phone;
  const normalized = normalizePhone(phone);
  const link = whatsAppLink(phone, rendered.text);

  return {
    milestoneId: args.milestoneId ?? "",
    milestoneTitle: args.title ?? "",
    templateKey: args.templateKey,
    clientName: trip.client.name,
    phoneDisplay: link.ok ? link.phoneDisplay : null,
    phoneE164: normalized.ok ? normalized.e164 : null,
    text: rendered.text,
    missing: rendered.missing,
    unknown: rendered.unknown,
    waUrl: link.ok ? link.url : null,
    waError: link.ok ? null : link.reason,
  };
}
