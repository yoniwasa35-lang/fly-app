import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  AUDIENCE_HE,
  COMPONENT_STATUS_HE,
  COMPONENT_TYPE_HE,
  MILESTONE_STATE_HE,
  TRIP_STATUS_HE,
  isComponentResolved,
  isOpenState,
  type ComponentStatus,
  type ComponentType,
  type MilestoneState,
} from "@/lib/domain/types";
import { buildDesiredMilestones, passportValidUntilRequirement } from "@/lib/milestones/engine";
import { loadTripSnapshot, parseBlockers } from "@/lib/milestones/sync";
import { hostAgencyName } from "@/lib/trips/finance";
import { airportLabel, allAirports } from "@/lib/time/airports";
import { knownAirlines } from "@/lib/airlines/checkin";
import { DISPLAY_TZ, formatAbsoluteHe, formatRelativeHe, utcToZoned } from "@/lib/time/zones";
import { publicTripUrl } from "@/lib/trips/publicToken";
import { whatsAppLink } from "@/lib/messages/whatsapp";
import { ClientLinkPanel } from "./ClientLinkPanel";
import { ComponentsPanel } from "./ComponentsPanel";
import { TravelersPanel } from "./TravelersPanel";
import { TripSettingsPanel } from "./TripSettingsPanel";
import { DepartureEditor } from "./DepartureEditor";
import { MoneyPanel } from "./MoneyPanel";

export const dynamic = "force-dynamic";

export default async function TripPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      client: true,
      travelers: { orderBy: { isLead: "desc" } },
      components: { include: { flight: true }, orderBy: { sortOrder: "asc" } },
      milestones: { orderBy: [{ dueAt: "asc" }] },
    },
  });
  if (!trip) notFound();

  const now = new Date();
  const snapshot = await loadTripSnapshot(trip.id);
  const { pendingAnchors } = buildDesiredMilestones(snapshot);

  const openMilestones = trip.milestones.filter((m) => isOpenState(m.state));
  const overdue = openMilestones.filter((m) => m.state === "overdue");
  const blocked = openMilestones.filter((m) => m.state === "blocked");
  const unresolvedComponents = trip.components.filter((c) => !isComponentResolved(c.status));

  const departure = formatRelativeHe(trip.departureAt, now);

  return (
    <>
      <header className="topbar">
        <h1>
          {trip.client.name} · {trip.destination}
          <span className="sub">
            תיק <span className="num">{trip.code}</span> · {TRIP_STATUS_HE[trip.status as keyof typeof TRIP_STATUS_HE]} ·
            טיסה {departure.text}
          </span>
        </h1>
        <Link className="btn" href="/">היום</Link>
      </header>

      {created && <div className="notice">התיק נפתח. אבני הדרך נוצרו ומופיעות למטה.</div>}

      {/*
        סעיף 8.3 — בעיה פתוחה מוצגת כהתראה מפורשת בטקסט, לא כאייקון.
      */}
      {(overdue.length > 0 || blocked.length > 0) && (
        <div className="error">
          {overdue.length > 0 && (
            <div>
              {overdue.length === 1
                ? `אבן דרך אחת עברה את מועדה: ${overdue[0].title}.`
                : `${overdue.length} אבני דרך עברו את מועדן, המוקדמת שבהן: ${overdue[0].title}.`}
            </div>
          )}
          {blocked.length > 0 && (
            <div style={{ marginTop: overdue.length ? "0.35rem" : 0 }}>
              {blocked.length === 1 ? "אבן דרך אחת חסומה" : `${blocked.length} אבני דרך חסומות`}
              {unresolvedComponents.length > 0 && (
                <> כי {unresolvedComponents.length === 1 ? "רכיב אחד עדיין לא אושר" : `${unresolvedComponents.length} רכיבים עדיין לא אושרו`}: {unresolvedComponents.map((c) => c.description || c.supplier || COMPONENT_TYPE_HE[c.type as ComponentType]).join(", ")}</>
              )}.
            </div>
          )}
        </div>
      )}

      {pendingAnchors.length > 0 && (
        <div className="notice">
          {pendingAnchors.length} אבני דרך ממתינות למידע חסר:{" "}
          {pendingAnchors.map((p) => `${p.title} (${p.reason})`).join(" · ")}. הן ייווצרו לבד ברגע שהמידע יוזן.
        </div>
      )}

      {/* ------------------------------ ציר אבני הדרך ------------------------------ */}
      <div className="card">
        <h2>אבני דרך</h2>
        <ul className="timeline">
          {trip.milestones.map((m) => {
            const state = m.state as MilestoneState;
            const rel = formatRelativeHe(m.dueAt, now);
            const blockers = parseBlockers(m.blockedByJson);
            const terminal = state === "done" || state === "skipped";
            return (
              <li key={m.id}>
                <span className={`dot s-${state}`} aria-hidden />
                <span className={`t ${terminal ? "muted" : ""}`}>{m.title}</span>
                <span className="d">
                  <span className="num">{formatAbsoluteHe(m.dueAt, { withTime: true })}</span>
                  {!terminal && <> · {rel.text}</>}
                  {" · "}
                  <span className={`tag tag-${state === "done" ? "done" : state === "overdue" ? "overdue" : state === "blocked" ? "blocked" : m.audience === "agent" ? "agent" : "client"}`}>
                    {MILESTONE_STATE_HE[state]}
                  </span>
                  {" "}
                  <span className="tag">{AUDIENCE_HE[m.audience as keyof typeof AUDIENCE_HE]}</span>
                  {m.snoozedUntil && m.snoozedUntil > now && (
                    <> · נדחה עד <span className="num">{formatAbsoluteHe(m.snoozedUntil, { withTime: false })}</span>: {m.snoozeReason}</>
                  )}
                  {m.skipReason && <> · ויתור: {m.skipReason}</>}
                  {blockers.length > 0 && <> · חסום: {blockers.map((b) => b.label).join("; ")}</>}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* -------------------------------- רכיבים --------------------------------- */}
      <div id="components">
        <ComponentsPanel
          tripId={trip.id}
          airports={allAirports().map((a) => ({ iata: a.iata, label: `${a.he} (${a.iata})` }))}
          airlines={knownAirlines()
            .map((a) => ({ code: a.code, label: `${a.name ?? a.code} (${a.code})` }))
            .sort((a, b) => a.label.localeCompare(b.label, "he"))}
          tripDates={{
            departureDate: trip.departureLocal.slice(0, 10),
            departureTime: trip.departureLocal.slice(11, 16),
            returnDate: trip.returnLocal.slice(0, 10),
            returnTime: trip.returnLocal.slice(11, 16),
            departureAirport: trip.departureAirport,
            returnAirport: trip.returnAirport,
          }}
          components={trip.components.map((c) => ({
            id: c.id,
            type: COMPONENT_TYPE_HE[c.type as ComponentType] ?? c.type,
            rawType: c.type,
            supplier: c.supplier,
            description: c.description,
            reference: c.reference,
            status: c.status as ComponentStatus,
            statusHe: COMPONENT_STATUS_HE[c.status as ComponentStatus] ?? c.status,
            freeCancelUntil: c.freeCancelUntil ? formatAbsoluteHe(c.freeCancelUntil, { withTime: false }) : null,
            supplierPaymentDue: c.supplierPaymentDue ? formatAbsoluteHe(c.supplierPaymentDue, { withTime: false }) : null,
            freeCancelInput: c.freeCancelUntil ? utcToZoned(c.freeCancelUntil, DISPLAY_TZ).slice(0, 10) : null,
            supplierPaymentInput: c.supplierPaymentDue ? utcToZoned(c.supplierPaymentDue, DISPLAY_TZ).slice(0, 10) : null,
            isFlight: !!c.flight,
            flightDefaults: c.type === "flight"
              ? {
                  componentId: c.id,
                  direction: (c.flight?.direction as "outbound" | "inbound") ?? "outbound",
                  airlineCode: c.flight?.airlineCode ?? "",
                  flightNumber: c.flight?.flightNumber ?? "",
                  departsAirport: c.flight?.departsAirport ?? trip.departureAirport,
                  departsDate: c.flight?.departsAtLocal?.slice(0, 10) ?? trip.departureLocal.slice(0, 10),
                  departsTime: c.flight?.departsAtLocal?.slice(11, 16) ?? trip.departureLocal.slice(11, 16),
                  arrivesAirport: c.flight?.arrivesAirport ?? trip.returnAirport,
                  arrivesDate: c.flight?.arrivesAtLocal?.slice(0, 10) ?? "",
                  arrivesTime: c.flight?.arrivesAtLocal?.slice(11, 16) ?? "",
                  baggageAllowance: c.flight?.baggageAllowance ?? "",
                }
              : null,
            checkinDone: c.flight?.checkinDone ?? false,
            checkinOpensAt: c.flight?.checkinOpensAt
              ? formatAbsoluteHe(c.flight.checkinOpensAt, { withTime: true })
              : null,
            checkinClosesAt: c.flight?.checkinClosesAt
              ? formatAbsoluteHe(c.flight.checkinClosesAt, { withTime: true })
              : null,
          }))}
        />
      </div>

      <TravelersPanel
        tripId={trip.id}
        requiredUntil={utcToZoned(passportValidUntilRequirement(snapshot), DISPLAY_TZ).slice(0, 10)}
        travelers={trip.travelers.map((t) => ({
          id: t.id,
          firstNameLatin: t.firstNameLatin,
          lastNameLatin: t.lastNameLatin,
          displayNameHe: t.displayNameHe,
          passportLast4: t.passportLast4,
          passportExpiry: t.passportExpiry ? utcToZoned(t.passportExpiry, DISPLAY_TZ).slice(0, 10) : null,
          passportCountry: t.passportCountry,
          dateOfBirth: t.dateOfBirth ? utcToZoned(t.dateOfBirth, DISPLAY_TZ).slice(0, 10) : null,
          phone: t.phone,
          isLead: t.isLead,
          expiryOk: t.passportExpiry
            ? t.passportExpiry.getTime() >= passportValidUntilRequirement(snapshot).getTime()
            : null,
        }))}
      />

      <MoneyPanel
        tripId={trip.id}
        priceToClient={trip.priceToClient}
        supplierCost={trip.supplierCost}
        actualSupplierCost={trip.actualSupplierCost}
        amountPaid={trip.amountPaid}
        hostFeeRate={trip.hostFeeRate}
        hostName={hostAgencyName()}
        settleMilestoneId={
          trip.milestones.find((m) => m.key === "close_actual_commission" && isOpenState(m.state))?.id ?? null
        }
      />

      {(() => {
        const url = publicTripUrl(trip.publicToken);
        const message = `היי, הנה עמוד הנסיעה שלכם ל${trip.destination}: ${url}`;
        const wa = url ? whatsAppLink(trip.client.phone, message) : null;
        return (
          <ClientLinkPanel
            tripId={trip.id}
            url={url}
            clientName={trip.client.name}
            destination={trip.destination}
            waUrl={wa?.ok ? wa.url : null}
          />
        );
      })()}

      <TripSettingsPanel
        tripId={trip.id}
        clientName={trip.client.name}
        clientPhone={trip.client.phone}
        clientEmail={trip.client.email}
        destination={trip.destination}
        source={trip.source}
        notes={trip.notes}
        status={trip.status}
        travelerCount={trip.travelers.length}
      />

      {/* ------------------------------ שינוי העוגן ------------------------------ */}
      <DepartureEditor
        tripId={trip.id}
        departureDate={trip.departureLocal.slice(0, 10)}
        departureTime={trip.departureLocal.slice(11, 16)}
        departureAirport={airportLabel(trip.departureAirport)}
        returnDate={trip.returnLocal.slice(0, 10)}
        returnTime={trip.returnLocal.slice(11, 16)}
        returnAirport={airportLabel(trip.returnAirport)}
      />
    </>
  );
}
