import { MilestoneActions } from "@/components/MilestoneActions";
import type { QueueItem } from "@/lib/queue/today";
import { formatAbsoluteHe, formatRelativeHe } from "@/lib/time/zones";

/**
 * "הפעולה הבאה".
 *
 * הדבר היחיד במסך שהסוכן חייב לראות לפני שהוא קורא משהו. הוא יושב מעל
 * הכל, בצבע של המצב שלו, ועליו הכפתור שעושה את הדבר עצמו — לא קישור
 * למסך שבו אפשר יהיה לעשות אותו.
 */
export function NextAction({
  next, now, context,
}: {
  next: QueueItem | null;
  now: Date;
  /** שורת ההקשר: תאריך הטיסה וחברת התעופה, כשהן רלוונטיות. */
  context: string | null;
}) {
  if (!next) {
    return (
      <section className="next-action is-clear">
        <span className="next-label">הכול מסודר</span>
        <p className="next-title">אין מה לעשות בנסיעה הזו כרגע.</p>
        <p className="next-when">כל מה שנשאר מחכה למועד רחוק יותר.</p>
      </section>
    );
  }

  return (
    <section className={`next-action is-${next.state}`}>
      <span className="next-label">הפעולה הבאה</span>
      <p className="next-title">{next.title}</p>
      <p className="next-when">
        <span className="num">{formatAbsoluteHe(next.dueAt, { withTime: true })}</span> ·{" "}
        {formatRelativeHe(next.dueAt, now).text}
        {context && <> · {context}</>}
      </p>
      <MilestoneActions item={next} />
    </section>
  );
}
