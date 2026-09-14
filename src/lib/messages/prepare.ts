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

export async function prepareMessage(
  milestoneId: string,
  opts: { overrideText?: string; now?: Date } = {},
): Promise<PreparedMessage> {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      trip: {
        include: {
          client: true,
          travelers: { orderBy: { isLead: "desc" } },
          components: { include: { flight: true }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!milestone) throw new Error("אבן הדרך לא נמצאה");
  if (!milestone.messageTemplateKey) {
    throw new Error(`לאבן הדרך "${milestone.title}" אין תבנית הודעה — היא פנימית.`);
  }

  const trip = milestone.trip;

  // אבן דרך שעוגנה בטיסת החזור מדברת על טיסת החזור. כל השאר על ההלוך.
  const direction = milestone.anchor === "flight_inbound" ? "inbound" : "outbound";
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
    now: opts.now ?? new Date(),
  };

  const template = await getTemplate(milestone.messageTemplateKey);
  const rendered = opts.overrideText
    ? { text: opts.overrideText, missing: [], unknown: [] }
    : renderTemplate(template.body, buildVariableValues(context));

  const lead = trip.travelers.find((t) => t.isLead && t.phone?.trim());
  const phone = lead?.phone?.trim() || trip.client.phone;
  const normalized = normalizePhone(phone);
  const link = whatsAppLink(phone, rendered.text);

  return {
    milestoneId,
    milestoneTitle: milestone.title,
    templateKey: milestone.messageTemplateKey,
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
