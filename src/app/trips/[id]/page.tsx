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
import { buildDesiredMilestones } from "@/lib/milestones/engine";
import { loadTripSnapshot, parseBlockers } from "@/lib/milestones/sync";
import { airportLabel } from "@/lib/time/airports";
import { DISPLAY_TZ, formatAbsoluteHe, formatRelativeHe, utcToZoned } from "@/lib/time/zones";
import { ComponentsPanel } from "./ComponentsPanel";
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
  const balance = trip.priceToClient - trip.amountPaid;

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
            isFlight: !!c.flight,
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

      {/* ------------------------------ נוסעים וכסף ------------------------------ */}
      <div className="card">
        <h2>נוסעים</h2>
        {trip.travelers.length === 0 ? (
          <p className="hint">עדיין לא הוזנו נוסעים. אבן הדרך &quot;קליטת פרטי נוסעים מדרכונים&quot; תזכיר.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>שם בדרכון</th><th>דרכון</th><th>תוקף</th></tr>
              </thead>
              <tbody>
                {trip.travelers.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className="ltr">{t.firstNameLatin} {t.lastNameLatin}</span>
                      {t.isLead && <> <span className="tag">איש קשר</span></>}
                    </td>
                    <td>{t.passportLast4 ? <span className="num">•••{t.passportLast4}</span> : "—"}</td>
                    <td>
                      {t.passportExpiry
                        ? <span className="num">{utcToZoned(t.passportExpiry, DISPLAY_TZ).slice(0, 10)}</span>
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MoneyPanel
        tripId={trip.id}
        priceToClient={trip.priceToClient}
        amountPaid={trip.amountPaid}
        balance={balance}
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
