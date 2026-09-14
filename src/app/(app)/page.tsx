import Link from "next/link";
import { QueueRow } from "@/components/QueueRow";
import { getTodayQueue, type DayGroup, type LateTripGroup, type QueueItem } from "@/lib/queue/today";
import { getFlightsToday, type FlightEvent } from "@/lib/queue/flights-today";
import { DISPLAY_TZ, formatAbsoluteHe, formatRelativeHe, utcToZoned } from "@/lib/time/zones";
import { BrandMark } from "@/components/Brand";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

/**
 * הברכה לפי שעת היום בישראל.
 *
 * אין כאן שם. לפי סעיף 6 יש סיסמה אחת משותפת לשני הסוכנים, ולכן המערכת
 * באמת לא יודעת מי פתח אותה. ברכה בשם היא נחמדה — אבל ברכה בשם הלא נכון
 * היא הדבר שגורם למישהו להפסיק לסמוך על מה שכתוב על המסך.
 */
function greeting(now: Date): string {
  const hour = Number(utcToZoned(now, DISPLAY_TZ).slice(11, 13));
  if (hour < 5) return "לילה טוב";
  if (hour < 12) return "בוקר טוב";
  if (hour < 17) return "צהריים טובים";
  if (hour < 21) return "ערב טוב";
  return "לילה טוב";
}

function Group({
  title, items, now, className, truncated, clock,
}: {
  title: string;
  items: QueueItem[];
  now: Date;
  className: string;
  truncated?: boolean;
  clock?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className={`group ${className}`}>
      <div className="group-head">
        <h2>{title}</h2>
        <span className="count">{items.length}</span>
        {items.length > 8 && <span className="hint">לפי קרבת הטיסה</span>}
      </div>
      <div className="stack">
        {items.map((item) => (
          <QueueRow key={item.id} item={item} now={now} clock={clock} />
        ))}
      </div>
      {truncated && (
        <p className="hint" style={{ padding: "var(--sp-2) var(--sp-5) 0" }}>
          מוצגות {items.length} הראשונות. יש עוד — טפלו באלה והשאר יופיעו.
        </p>
      )}
    </section>
  );
}

/** מי ממריא ומי נוחת היום. לא משימה — מידע שצריך להיות מול העיניים. */
function FlightStrip({ events }: { events: FlightEvent[] }) {
  if (events.length === 0) return null;

  return (
    <section className="group">
      <div className="group-head">
        <h2 className="plain">בשמיים היום</h2>
        <span className="count">{events.length}</span>
      </div>
      <div className="flight-strip">
        {events.map((e) => (
          <Link key={e.id} className="flight-chip" href={`/trips/${e.tripId}`}>
            <span className="flight-chip-time num">{e.time}</span>
            <span className="flight-chip-main">
              <strong>{e.clientName}</strong>
              <small>
                {e.kind === "departure" ? "ממריאים" : "נוחתים"} · {e.airport} ·{" "}
                <span className="num">{e.flightNumber}</span>
              </small>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * "עד סוף השבוע" מקובץ לפי יום ומתקפל. בקצב של 100+ תיקים פעילים הקבוצה
 * הזו מגיעה למאות פריטים, ורשימה שטוחה כזו היא בדיוק המסך שהסוכן מפסיק
 * להסתכל עליו — סעיף 14.
 */
function WeekPreview({ days, now }: { days: DayGroup[]; now: Date }) {
  if (days.length === 0) return null;
  const total = days.reduce((n, d) => n + d.items.length, 0);

  return (
    <section className="group group-week">
      <div className="group-head">
        <h2>עד סוף השבוע</h2>
        <span className="count">{total}</span>
      </div>
      {days.map((day) => (
        <details key={day.day} className="collapse day">
          <summary>
            {formatAbsoluteHe(day.date, { withWeekday: true, withTime: false })}
            <span className="count">{day.items.length}</span>
            <span className="hint">{day.items.slice(0, 2).map((i) => i.title).join(" · ")}</span>
          </summary>
          <div className="stack">
            {day.items.map((item) => (
              <QueueRow key={item.id} item={item} now={now} />
            ))}
          </div>
        </details>
      ))}
    </section>
  );
}

/**
 * סעיף 14, תיק שנוצר מאוחר. מקובץ לפי תיק ולא לפי אבן דרך: ככה באמת
 * סוגרים אותן — פותחים את התיק פעם אחת ועוברים על כולן בהקשר, במקום
 * לרדוף אחרי מאה שורות אדומות מפוזרות.
 */
function BornLate({ trips, total, now }: { trips: LateTripGroup[]; total: number; now: Date }) {
  if (trips.length === 0) return null;

  return (
    <details className="collapse">
      <summary>
        {total} אבני דרך נולדו באיחור, ב-{trips.length} תיקים
        <span className="hint">
          תיקים שנפתחו קרוב ליציאה. לפתוח כל תיק פעם אחת ולסגור — הן לא ייעלמו מעצמן.
        </span>
      </summary>
      <div className="stack">
        {trips.map((t) => {
          const rel = formatRelativeHe(t.departureAt, now);
          return (
            <Link key={t.tripId} className="row is-pending late-row" href={`/trips/${t.tripId}`}>
              <span className="title">
                {t.clientName} · {t.destination}
              </span>
              <span className="when">
                {t.count}
                <small>אבני דרך</small>
              </span>
              <span className="meta">
                <span className="tag">טיסה {rel.text}</span>
                <span className="hint">{t.sample.join(" · ")}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </details>
  );
}

export default async function TodayPage() {
  const [queue, flights] = await Promise.all([getTodayQueue(), getFlightsToday()]);
  const actionable = queue.counts.overdue + queue.counts.today;
  const nothingAtAll =
    actionable === 0 &&
    queue.counts.thisWeek === 0 &&
    queue.counts.bornLate === 0 &&
    flights.length === 0;

  return (
    <>
      <header className="topbar">
        <BrandMark className="topbar-brand" />
        <h1>
          היום
          <span className="sub">
            {formatAbsoluteHe(queue.now, { withWeekday: true, withTime: false })}
          </span>
        </h1>
      </header>

      {/* שורה אחת שעונה על "מה יש לי היום" לפני שמסתכלים על משהו אחר */}
      <section className="hello">
        <p className="hello-line">
          {greeting(queue.now)}
          {actionable > 0 ? (
            <>
              , יש {actionable} {actionable === 1 ? "דבר" : "דברים"} לטפל בהם היום.
            </>
          ) : (
            <>, הכל מסודר.</>
          )}
        </p>
        {flights.length > 0 && (
          <p className="hello-sub">
            {flights.filter((f) => f.kind === "departure").length > 0 && (
              <>{flights.filter((f) => f.kind === "departure").length} ממריאים</>
            )}
            {flights.some((f) => f.kind === "departure") &&
              flights.some((f) => f.kind === "arrival") && <> · </>}
            {flights.filter((f) => f.kind === "arrival").length > 0 && (
              <>{flights.filter((f) => f.kind === "arrival").length} נוחתים</>
            )}
          </p>
        )}
      </section>

      {nothingAtAll && (
        <div className="empty">
          <Icon name="inbox" />
          <strong>אין מה לעשות עכשיו.</strong>
          כל מה שנדרש השבוע טופל. אבני דרך רחוקות יותר יופיעו כאן כשיגיע מועדן.
        </div>
      )}

      <FlightStrip events={flights} />

      <BornLate trips={queue.bornLate} total={queue.counts.bornLate} now={queue.now} />

      <Group
        title="עבר מועד" items={queue.overdue} now={queue.now}
        className="group-overdue" truncated={queue.truncated.overdue}
      />
      <Group
        title="היום" items={queue.today} now={queue.now} clock
        className="group-today" truncated={queue.truncated.today}
      />
      <WeekPreview days={queue.thisWeek} now={queue.now} />
    </>
  );
}
