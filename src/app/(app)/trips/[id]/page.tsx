import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  AUDIENCE_HE,
  COMPONENT_STATUS_HE,
  COMPONENT_TYPE_HE,
  MILESTONE_STATE_HE,
  isComponentResolved,
  isOpenState,
  type ComponentStatus,
  type ComponentType,
  type MilestoneState,
} from "@/lib/domain/types";
import { buildDesiredMilestones, passportValidUntilRequirement } from "@/lib/milestones/engine";
import { loadTripSnapshot, parseBlockers } from "@/lib/milestones/sync";
import { hostAgencyName, shekels } from "@/lib/trips/finance";
import { airportLabel, allAirports } from "@/lib/time/airports";
import { knownAirlines } from "@/lib/airlines/checkin";
import { DISPLAY_TZ, formatAbsoluteHe, formatRelativeHe, utcToZoned } from "@/lib/time/zones";
import { publicTripUrl } from "@/lib/trips/publicToken";
import { whatsAppLink } from "@/lib/messages/whatsapp";
import { summarizeTrip, PAYMENT_STATUS_HE } from "@/lib/trips/summary";
import { describeParty } from "@/lib/clients/party";
import { getDocuments } from "@/lib/trips/documents";
import { templateSchedules } from "@/lib/messages/schedule";
import { toItem } from "@/lib/queue/today";
import { Icon } from "@/components/Icon";
import { ClientLinkPanel } from "./ClientLinkPanel";
import { ComponentsPanel } from "./ComponentsPanel";
import { TravelersPanel } from "./TravelersPanel";
import { TripSettingsPanel } from "./TripSettingsPanel";
import { DepartureEditor } from "./DepartureEditor";
import { MoneyPanel } from "./MoneyPanel";
import { DocumentsPanel } from "./DocumentsPanel";
import { FlightsPanel, type FlightRow } from "./FlightsPanel";
import { directionFromLabel } from "@/lib/trips/flightLabels";
import { HotelPanel } from "./HotelPanel";
import { CoverEditor } from "./CoverEditor";
import { NextAction } from "./TripCard";
import { TripTasksPanel, type TaskRow } from "./TripTasksPanel";
import { TripSheets, type Tile } from "./TripSheets";

export const dynamic = "force-dynamic";

/** הפס העליון: נקודה, טקסט אחד, וזהו. */
function statusPill(status: string, departureAt: Date, now: Date) {
  if (status === "traveling") return { tone: "good", text: "בטיול עכשיו" };
  if (status === "returned" || status === "closed") return { tone: "muted", text: "הנסיעה הסתיימה" };

  const days = Math.ceil((departureAt.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return { tone: "muted", text: "תאריך היציאה עבר" };
  if (days === 0) return { tone: "warn", text: "יוצאים היום" };
  if (days === 1) return { tone: "warn", text: "יוצאים מחר" };
  if (days <= 3) return { tone: "warn", text: `יוצאים בעוד ${days} ימים` };
  return { tone: "good", text: `יוצאים בעוד ${days} ימים` };
}

export default async function TripPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; copied?: string }>;
}) {
  const { id } = await params;
  const { created, copied } = await searchParams;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      client: true,
      travelers: { orderBy: { isLead: "desc" } },
      components: { include: { flight: true, stay: true }, orderBy: { sortOrder: "asc" } },
      milestones: { orderBy: [{ dueAt: "asc" }] },
    },
  });
  if (!trip) notFound();

  const now = new Date();
  const [snapshot, documents] = await Promise.all([loadTripSnapshot(trip.id), getDocuments(trip.id)]);
  const { pendingAnchors } = buildDesiredMilestones(snapshot);

  const openMilestones = trip.milestones.filter((m) => isOpenState(m.state));
  const overdue = openMilestones.filter((m) => m.state === "overdue");
  const blocked = openMilestones.filter((m) => m.state === "blocked");
  const unresolvedComponents = trip.components.filter((c) => !isComponentResolved(c.status));

  const summary = summarizeTrip(trip);
  const party = describeParty(trip.client);
  const pill = statusPill(trip.status, trip.departureAt, now);

  /*
   * הפעולה הבאה: הפתוחה שמועדה הקרוב ביותר. חסומות יוצאות מהמשחק — אי
   * אפשר לפעול עליהן, והצגתן שם הייתה שולחת את הסוכן לקיר. נדחות שמועדן
   * טרם הגיע יוצאות מאותה סיבה.
   */
  const nextMilestone =
    openMilestones
      .filter((m) => m.state !== "blocked")
      .filter((m) => !m.snoozedUntil || m.snoozedUntil <= now)
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0] ?? null;

  const next = nextMilestone
    ? toItem({
        id: nextMilestone.id,
        key: nextMilestone.key,
        title: nextMilestone.title,
        audience: nextMilestone.audience,
        state: nextMilestone.state,
        dueAt: nextMilestone.dueAt,
        blockedByJson: nextMilestone.blockedByJson,
        bornLate: nextMilestone.bornLate,
        messageTemplateKey: nextMilestone.messageTemplateKey,
        trip: {
          id: trip.id, code: trip.code, destination: trip.destination,
          departureAt: trip.departureAt,
          client: { name: trip.client.name, phone: trip.client.phone },
        },
      })
    : null;

  const outboundFlight = summary.outbound;
  const nextContext = outboundFlight
    ? `${outboundFlight.airlineCode} ${outboundFlight.flightNumber}`.trim()
    : null;

  /* ------------------------------ האריחים ------------------------------ */

  const flightCount = [summary.outbound, summary.inbound].filter(Boolean).length;

  /*
   * הנקודה הכתומה שמורה ל"מתקרב ולא מוכן", ולא ל"עוד לא הוזן". תיק
   * שנפתח היום ועוד אין בו מלון הוא מצב תקין לגמרי; אותו תיק שלושה ימים
   * לפני היציאה הוא כבר משהו אחר. בלי ההבחנה הזו כל אריח נצבע כתום
   * ביום הראשון, וסעיף 4 מתרוקן מתוכן: כשהכל מתריע, שום דבר לא מתריע.
   */
  const daysToDeparture = Math.ceil((trip.departureAt.getTime() - now.getTime()) / 86_400_000);
  const closingIn = daysToDeparture <= 14 && trip.status !== "returned" && trip.status !== "closed";

  const tiles: Tile[] = [
    {
      key: "flights", icon: "trips", label: "טיסות",
      value: flightCount === 2 ? "הלוך וחזור" : flightCount === 1 ? "טיסה אחת" : "לא הוזנו",
      attention: closingIn && flightCount === 0,
    },
    {
      key: "hotel", icon: "hotel", label: "מלון",
      value: summary.stay?.name ?? "לא הוזן",
      // נסיעת טיסה־בלבד היא מוצר לגיטימי. היעדר מלון אינו תקלה.
      attention: false,
    },
    {
      key: "travelers", icon: "clients", label: "נוסעים",
      value: trip.travelers.length > 0 ? `${trip.travelers.length} רשומים` : party,
      attention: closingIn && trip.travelers.length === 0,
    },
    {
      key: "money", icon: "wallet", label: "תשלומים",
      value:
        summary.money.balance > 0
          ? `נותר ${shekels(summary.money.balance)}`
          : PAYMENT_STATUS_HE[summary.money.status],
      attention: summary.money.balance > 0,
    },
    {
      key: "documents", icon: "document", label: "מסמכים",
      value: `${documents.ready} מתוך ${documents.total} מוכנים`,
      attention: closingIn && documents.ready < documents.total,
    },
    {
      key: "tasks", icon: "tasks", label: "משימות",
      value: openMilestones.length > 0 ? `${openMilestones.length} פתוחות` : "הכול סגור",
      attention: overdue.length > 0,
    },
  ];

  /* נוסחי ההודעות שהסוכן יכול ליזום — רק אלה שפונים ללקוח. */
  const messageOptions = [...templateSchedules().entries()]
    .filter(([, s]) => s.toClient)
    .map(([key, s]) => ({ key, label: s.title }));

  const airports = allAirports().map((a) => ({ iata: a.iata, label: `${a.he} (${a.iata})` }));
  const airlines = knownAirlines()
    .map((a) => ({ code: a.code, label: `${a.name ?? a.code} (${a.code})` }))
    .sort((a, b) => a.label.localeCompare(b.label, "he"));

  const url = publicTripUrl(trip.publicToken);
  const wa = url ? whatsAppLink(trip.client.phone, `היי, הנה עמוד הנסיעה שלכם ל${trip.destination}: ${url}`) : null;

  /* ------------------------------ החלונות ------------------------------ */

  const flightRows: FlightRow[] = trip.components
    .filter((c) => c.type === "flight")
    .map((c) => {
      const f = c.flight;
      const filled = !!f && !!f.airlineCode && !!f.flightNumber;

      /*
       * טיסה שנוצרה ועוד לא מולאה יודעת את כיוונה רק מהתיאור. הכיוון
       * קובע את כל ברירות המחדל שאחריו, ולכן הוא נקבע פעם אחת כאן.
       */
      const direction = (f?.direction as "outbound" | "inbound") ?? directionFromLabel(c.description);

      /*
       * ברירות מחדל לפי הכיוון: טיסת חזור יוצאת משדה היעד וחוזרת הביתה,
       * בתאריך החזרה. קודם היא נפתחה על שדה היציאה ועל תאריך היציאה —
       * שני תיקונים ידניים בכל טיסת חזור.
       */
      const fromTrip = direction === "inbound"
        ? { departs: trip.returnAirport, arrives: trip.departureAirport, local: trip.returnLocal }
        : { departs: trip.departureAirport, arrives: trip.returnAirport, local: trip.departureLocal };

      return {
        componentId: c.id,
        direction,
        line: filled
          ? `${f!.departsAirport} ${f!.departsAtLocal.slice(11, 16)} ← ${f!.arrivesAirport}${f!.arrivesAtLocal ? ` ${f!.arrivesAtLocal.slice(11, 16)}` : ""}`
          : null,
        dateLabel: f?.departsAtLocal
          ? formatAbsoluteHe(new Date(`${f.departsAtLocal.slice(0, 10)}T12:00:00Z`), { withTime: false })
          : null,
        flightNumber: filled ? `${f!.airlineCode} ${f!.flightNumber}` : null,
        baggage: f?.baggageAllowance ?? null,
        checkinDone: f?.checkinDone ?? false,
        defaults: {
          componentId: c.id,
          direction,
          airlineCode: f?.airlineCode ?? "",
          flightNumber: f?.flightNumber ?? "",
          departsAirport: f?.departsAirport ?? fromTrip.departs,
          departsDate: f?.departsAtLocal?.slice(0, 10) ?? fromTrip.local.slice(0, 10),
          departsTime: f?.departsAtLocal?.slice(11, 16) ?? fromTrip.local.slice(11, 16),
          arrivesAirport: f?.arrivesAirport ?? fromTrip.arrives,
          arrivesDate: f?.arrivesAtLocal?.slice(0, 10) ?? "",
          arrivesTime: f?.arrivesAtLocal?.slice(11, 16) ?? "",
          baggageAllowance: f?.baggageAllowance ?? "",
        },
      };
    });

  const flightsSheet = (
    <FlightsPanel tripId={trip.id} flights={flightRows} airports={airports} airlines={airlines} />
  );

  const hotelComponent = trip.components.find((c) => c.type === "hotel" && c.status !== "cancelled");
  const stay = hotelComponent?.stay ?? null;

  const hotelSummary = (
    <dl className="c-details">
      <dt>תאריכים</dt>
      <dd>
        <span className="num">{formatAbsoluteHe(trip.departureAt, { withTime: false })}</span>
        {" – "}
        <span className="num">{formatAbsoluteHe(trip.returnAt, { withTime: false })}</span> ·{" "}
        {summary.nights} לילות
      </dd>
      {hotelComponent?.reference && (
        <>
          <dt>מספר הזמנה</dt>
          <dd className="num">{hotelComponent.reference}</dd>
        </>
      )}
      {hotelComponent && (
        <>
          <dt>סטטוס</dt>
          <dd>{COMPONENT_STATUS_HE[hotelComponent.status as ComponentStatus] ?? hotelComponent.status}</dd>
        </>
      )}
    </dl>
  );

  const hotelSheet = (
    <HotelPanel
      tripId={trip.id}
      summary={hotelSummary}
      initial={
        hotelComponent
          ? {
              componentId: hotelComponent.id,
              name: stay?.name ?? hotelComponent.supplier ?? "",
              roomType: stay?.roomType ?? "",
              boardBasis: stay?.boardBasis ?? "",
              checkInTime: stay?.checkInTime ?? "",
              checkOutTime: stay?.checkOutTime ?? "",
              officialUrl: stay?.officialUrl ?? "",
              voucherUrl: stay?.voucherUrl ?? "",
              address: stay?.address ?? "",
              stars: stay?.stars ? String(stay.stars) : "",
            }
          : null
      }
    />
  );

  const taskRows: TaskRow[] = trip.milestones.map((m) => ({
    ...toItem({
      id: m.id,
      key: m.key,
      title: m.title,
      audience: m.audience,
      state: m.state,
      dueAt: m.dueAt,
      blockedByJson: m.blockedByJson,
      bornLate: m.bornLate,
      messageTemplateKey: m.messageTemplateKey,
      trip: {
        id: trip.id, code: trip.code, destination: trip.destination,
        departureAt: trip.departureAt,
        client: { name: trip.client.name, phone: trip.client.phone },
      },
    }),
    dateLabel: formatAbsoluteHe(m.dueAt, { withTime: true }),
    relative: formatRelativeHe(m.dueAt, now).text,
    note:
      m.skipReason ? `בוטל: ${m.skipReason}`
      : m.snoozedUntil && m.snoozedUntil > now
        ? `נדחה עד ${formatAbsoluteHe(m.snoozedUntil, { withTime: false })}${m.snoozeReason ? `: ${m.snoozeReason}` : ""}`
        : null,
  }));

  const tasksSheet = <TripTasksPanel items={taskRows} />;

  const hero = (
    <>
      <h1>{trip.client.name}</h1>
      <p className="trip-hero-sub">
        {trip.destination} ·{" "}
        <span className="num">{formatAbsoluteHe(trip.departureAt, { withTime: false })}</span>
        {" – "}
        <span className="num">{formatAbsoluteHe(trip.returnAt, { withTime: false })}</span>
      </p>
      <span className={`status-pill is-${pill.tone}`}>{pill.text}</span>
    </>
  );

  const body = (
    <>
      {created && (
        <div className="notice">
          <Icon name="check" />
          <span>
            הנסיעה נפתחה והמשימות נוצרו.
            {copied && copied !== "0" && <> {copied} נוסעים הועתקו — כדאי לוודא שהדרכונים בתוקף.</>}
          </span>
        </div>
      )}

      <NextAction next={next} now={now} context={nextContext} />

      {/* סעיף 8.3 — בעיה פתוחה מוצגת כהתראה מפורשת בטקסט, לא כאייקון. */}
      {(overdue.length > 1 || blocked.length > 0 || pendingAnchors.length > 0) && (
        <details className="collapse section trip-alerts">
          <summary>
            {overdue.length > 1 && <>{overdue.length} משימות עברו את מועדן</>}
            {overdue.length > 1 && blocked.length > 0 && <> · </>}
            {blocked.length > 0 && <>{blocked.length} חסומות</>}
            {(overdue.length > 1 || blocked.length > 0) && pendingAnchors.length > 0 && <> · </>}
            {pendingAnchors.length > 0 && <>{pendingAnchors.length} ממתינות למידע</>}
          </summary>
          <div className="card">
            {blocked.length > 0 && unresolvedComponents.length > 0 && (
              <p>
                החסימה נובעת מ{unresolvedComponents.length === 1 ? "רכיב שעדיין לא אושר" : `${unresolvedComponents.length} רכיבים שעדיין לא אושרו`}:{" "}
                {unresolvedComponents
                  .map((c) => c.description || c.supplier || COMPONENT_TYPE_HE[c.type as ComponentType])
                  .join(", ")}
                .
              </p>
            )}
            {pendingAnchors.length > 0 && (
              <p className="hint">
                {pendingAnchors.map((p) => `${p.title} (${p.reason})`).join(" · ")}. הן ייווצרו לבד
                ברגע שהמידע יוזן.
              </p>
            )}
          </div>
        </details>
      )}
    </>
  );

  return (
    <>
      <TripSheets
        hero={hero}
        body={body}
        tiles={tiles}
        tripId={trip.id}
        clientId={trip.clientId}
        clientPhone={trip.client.phone}
        messageOptions={messageOptions}
        flights={flightsSheet}
        hotel={hotelSheet}
        tasks={tasksSheet}
        documents={<DocumentsPanel tripId={trip.id} rows={documents.rows} />}
        travelers={
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
        }
        money={
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
        }
        booking={
          <ComponentsPanel
            tripId={trip.id}
            airports={airports}
            airlines={airlines}
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
        }
        edit={
          <>
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
        }
        link={
          <>
          <CoverEditor
            tripId={trip.id}
            imageUrl={trip.coverImageUrl ?? ""}
            credit={trip.coverCredit ?? ""}
          />
          <ClientLinkPanel
            tripId={trip.id}
            url={url}
            clientName={trip.client.name}
            destination={trip.destination}
            waUrl={wa?.ok ? wa.url : null}
          />
          </>
        }
      />
    </>
  );
}
