import Link from "next/link";
import { QueueRow } from "@/components/QueueRow";
import { getTodayQueue, type QueueItem } from "@/lib/queue/today";
import { formatAbsoluteHe } from "@/lib/time/zones";

export const dynamic = "force-dynamic";

function Group({
  title, items, now, className,
}: {
  title: string;
  items: QueueItem[];
  now: Date;
  className: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className={`group ${className}`}>
      <div className="group-head">
        <h2>{title}</h2>
        <span className="count">{items.length}</span>
      </div>
      <div className="stack">
        {items.map((item) => (
          <QueueRow key={item.id} item={item} now={now} />
        ))}
      </div>
    </section>
  );
}

export default async function TodayPage() {
  const queue = await getTodayQueue();
  const total = queue.counts.overdue + queue.counts.today + queue.counts.thisWeek;

  return (
    <>
      <header className="topbar">
        <h1>
          היום
          <span className="sub">{formatAbsoluteHe(queue.now, { withWeekday: true, withTime: false })}</span>
        </h1>
        <Link className="btn" href="/trips/new">תיק חדש</Link>
      </header>

      {total === 0 && queue.counts.bornLate === 0 && (
        <div className="empty">
          <strong>אין מה לעשות עכשיו.</strong>
          כל מה שנדרש השבוע טופל. אבני דרך רחוקות יותר יופיעו כאן כשיגיע מועדן.
        </div>
      )}

      {/*
        סעיף 14 — תיק שנוצר מאוחר. אבני דרך שנולדו כבר באיחור מקובצות לשורה
        אחת מתקפלת, כדי שלקוח שנסגר שבועיים לפני הטיסה לא יצבע את כל המסך באדום.
      */}
      {queue.counts.bornLate > 0 && (
        <details className="collapse">
          <summary>
            {queue.counts.bornLate} אבני דרך נולדו באיחור
            <span className="hint">
              תיקים שנפתחו קרוב ליציאה. לעבור עליהן פעם אחת ולסגור — הן לא ייעלמו מעצמן.
            </span>
          </summary>
          <div className="stack">
            {queue.bornLate.map((item) => (
              <QueueRow key={item.id} item={item} now={queue.now} />
            ))}
          </div>
        </details>
      )}

      <Group title="עבר מועד" items={queue.overdue} now={queue.now} className="group-overdue" />
      <Group title="היום" items={queue.today} now={queue.now} className="group-today" />
      <Group title="עד סוף השבוע" items={queue.thisWeek} now={queue.now} className="group-week" />
    </>
  );
}
