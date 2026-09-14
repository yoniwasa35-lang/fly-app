import Link from "next/link";
import { QueueRow } from "@/components/QueueRow";
import { getTodayQueue, type DayGroup, type LateTripGroup, type QueueItem } from "@/lib/queue/today";
import { formatAbsoluteHe, formatRelativeHe } from "@/lib/time/zones";

export const dynamic = "force-dynamic";

function Group({
  title, items, now, className, truncated,
}: {
  title: string;
  items: QueueItem[];
  now: Date;
  className: string;
  truncated?: boolean;
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
          <QueueRow key={item.id} item={item} now={now} />
        ))}
      </div>
      {truncated && (
        <p className="hint" style={{ padding: "0.4rem 1rem 0" }}>
          מוצגות {items.length} הראשונות. יש עוד — טפלו באלה והשאר יופיעו.
        </p>
      )}
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
        {trips.map((t) => (
          <Link key={t.tripId} href={`/trips/${t.tripId}`} className="row is-overdue late-row">
            <div className="title">{t.clientName} · {t.destination}</div>
            <div className="when">
              {formatRelativeHe(t.departureAt, now).text}
              <small>טיסה</small>
            </div>
            <div className="meta">
              <span className="tag tag-overdue">{t.count} באיחור</span>
              <span className="hint">{t.sample.join(" · ")}</span>
            </div>
          </Link>
        ))}
      </div>
    </details>
  );
}

export default async function TodayPage() {
  const queue = await getTodayQueue();
  const actionable = queue.counts.overdue + queue.counts.today;
  const nothingAtAll = actionable === 0 && queue.counts.thisWeek === 0 && queue.counts.bornLate === 0;

  return (
    <>
      <header className="topbar">
        <h1>
          היום
          <span className="sub">
            {formatAbsoluteHe(queue.now, { withWeekday: true, withTime: false })}
            {actionable > 0 && <> · {actionable} לפעולה</>}
          </span>
        </h1>
        <Link className="btn" href="/trips/new">תיק חדש</Link>
      </header>

      {nothingAtAll && (
        <div className="empty">
          <strong>אין מה לעשות עכשיו.</strong>
          כל מה שנדרש השבוע טופל. אבני דרך רחוקות יותר יופיעו כאן כשיגיע מועדן.
        </div>
      )}

      <BornLate trips={queue.bornLate} total={queue.counts.bornLate} now={queue.now} />

      <Group
        title="עבר מועד" items={queue.overdue} now={queue.now}
        className="group-overdue" truncated={queue.truncated.overdue}
      />
      <Group
        title="היום" items={queue.today} now={queue.now}
        className="group-today" truncated={queue.truncated.today}
      />
      <WeekPreview days={queue.thisWeek} now={queue.now} />
    </>
  );
}
