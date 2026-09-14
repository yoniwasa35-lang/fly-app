import Link from "next/link";
import { Icon } from "@/components/Icon";
import { MilestoneActions } from "@/components/MilestoneActions";
import type { QueueItem } from "@/lib/queue/today";
import { PAYMENT_STATUS_HE, type TripSummary, type SummaryFlight } from "@/lib/trips/summary";
import { shekels } from "@/lib/trips/finance";
import { formatAbsoluteHe, formatRelativeHe } from "@/lib/time/zones";

/**
 * הכרטיס שנפתח ראשון.
 *
 * העיקרון היחיד שמפעיל אותו: "הפעולה הבאה" קודמת לכל מידע. סוכן שפותח
 * תיק לא בא לקרוא — הוא בא לדעת מה לעשות. אחר כך מגיעות שש שורות שעונות
 * על "מה המצב", וכל השאר יורד לאזורים שנפתחים בלחיצה.
 */

function FlightLine({ flight, label }: { flight: SummaryFlight | null; label: string }) {
  if (!flight) {
    return (
      <div className="tc-line tc-line-empty">
        <Icon name="trips" />
        <div>
          <strong>{label}</strong>
          <small>עוד לא הוזנה</small>
        </div>
      </div>
    );
  }

  return (
    <div className="tc-line">
      <Icon name="trips" />
      <div>
        <strong>{label}</strong>
        <small>
          <span className="num">{flight.date.slice(8, 10)}/{flight.date.slice(5, 7)}</span> ·{" "}
          <span className="num">{flight.time}</span>
          {flight.arrivesTime && (
            <>
              {" – "}
              <span className="num">{flight.arrivesTime}</span>
            </>
          )}{" "}
          · <span className="ltr">{flight.fromAirport}→{flight.toAirport}</span>
          {flight.baggage && <> · {flight.baggage}</>}
        </small>
      </div>
      {flight.checkinDone && <span className="tag tag-done">צ׳ק-אין בוצע</span>}
    </div>
  );
}

export function TripCard({
  summary, next, now, destination, departureAt, returnAt, party, openCount,
}: {
  summary: TripSummary;
  /** אבן הדרך הפתוחה הקרובה ביותר, אם יש. */
  next: QueueItem | null;
  now: Date;
  destination: string;
  departureAt: Date;
  returnAt: Date;
  party: string;
  /** אבני דרך פתוחות — מוצג בשורת התאריכים, לא לצד הרכיבים. */
  openCount: number;
}) {
  const money = summary.money;

  return (
    <>
      {/* ------------------------------ הפעולה הבאה ---------------------------- */}
      {next ? (
        <section className={`next-action is-${next.state}`}>
          <span className="next-label">הפעולה הבאה</span>
          <p className="next-title">{next.title}</p>
          <p className="next-when">
            <span className="num">{formatAbsoluteHe(next.dueAt, { withTime: true })}</span> ·{" "}
            {formatRelativeHe(next.dueAt, now).text}
          </p>
          <MilestoneActions item={next} />
        </section>
      ) : (
        <section className="next-action is-clear">
          <span className="next-label">הפעולה הבאה</span>
          <p className="next-title">אין מה לעשות בתיק הזה כרגע.</p>
          <p className="next-when">כל אבני הדרך הפתוחות מחכות למועד רחוק יותר.</p>
        </section>
      )}

      {/* -------------------------------- הכרטיס ------------------------------- */}
      <section className="trip-summary">
        <header className="tc-head">
          <h2>{destination}</h2>
          <p>
            <span className="num">{formatAbsoluteHe(departureAt, { withTime: false })}</span>
            {" – "}
            <span className="num">{formatAbsoluteHe(returnAt, { withTime: false })}</span>
            {" · "}
            {summary.nights} {summary.nights === 1 ? "לילה" : "לילות"}
          </p>
          <p className="tc-party">
            {party}
            {openCount > 0 && <> · {openCount} משימות פתוחות</>}
          </p>
        </header>

        <FlightLine flight={summary.outbound} label="טיסה הלוך" />

        {summary.stay ? (
          <div className="tc-line">
            <Icon name="inbox" />
            <div>
              <strong>{summary.stay.name}</strong>
              <small>{summary.stay.detail ?? (summary.stay.confirmed ? "אושר" : "ממתין לאישור")}</small>
            </div>
            {!summary.stay.confirmed && <span className="tag tag-money">לא אושר</span>}
          </div>
        ) : (
          <div className="tc-line tc-line-empty">
            <Icon name="inbox" />
            <div>
              <strong>מלון</strong>
              <small>עוד לא הוזן</small>
            </div>
          </div>
        )}

        <FlightLine flight={summary.inbound} label="טיסה חזור" />

        <div className="tc-line">
          <Icon name="tasks" />
          <div>
            <strong>תשלום</strong>
            <small>
              {shekels(money.price)}
              {money.balance > 0 && <> · נותר {shekels(money.balance)}</>}
            </small>
          </div>
          <span className={`tag ${money.status === "paid" ? "tag-done" : money.status === "partial" ? "tag-money" : "tag-overdue"}`}>
            {PAYMENT_STATUS_HE[money.status]}
          </span>
        </div>

        {summary.components.total > 0 && (
          <div className="tc-line">
            <Icon name="check" />
            <div>
              <strong>רכיבים</strong>
              <small>
                {summary.components.confirmed} מתוך {summary.components.total} סגורים
              </small>
            </div>
            {summary.components.confirmed < summary.components.total && (
              <span className="tag tag-money">
                {summary.components.total - summary.components.confirmed} ממתינים
              </span>
            )}
          </div>
        )}
      </section>
    </>
  );
}

/** קיצורי דרך לאזורים שמתחת. ניווט בתוך העמוד, לא ניווט בין מסכים. */
export function TripJump({ links }: { links: { id: string; label: string }[] }) {
  return (
    <nav className="chips trip-jump" aria-label="אזורי התיק">
      {links.map((l) => (
        <Link key={l.id} className="btn-quiet" href={`#${l.id}`}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
