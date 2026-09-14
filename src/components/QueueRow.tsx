import Link from "next/link";
import type { QueueItem } from "@/lib/queue/today";
import { AUDIENCE_HE } from "@/lib/domain/types";
import { DISPLAY_TZ, formatAbsoluteHe, formatRelativeHe, utcToZoned } from "@/lib/time/zones";
import { MilestoneActions } from "./MilestoneActions";

/** האם אבן הדרך נוגעת בכסף — תגית נפרדת לפי סעיף 8.1. */
const MONEY_KEYS = new Set(["collect_balance", "close_actual_commission"]);
const isMoney = (key: string) => MONEY_KEYS.has(key) || key.startsWith("component_payment_due:");

/**
 * `clock` הופך את צד הזמן משעון יחסי ("בעוד 3 שעות") לשעה על השעון
 * ("09:00"). זה הנכון למה שקורה היום — הסוכן מסדר את היום שלו לפי שעות —
 * ולא נכון לפריט שמועדו בעוד שבועיים, שם השעה המדויקת חסרת משמעות.
 */
export function QueueRow({
  item,
  now,
  clock = false,
}: {
  item: QueueItem;
  now: Date;
  clock?: boolean;
}) {
  const rel = formatRelativeHe(item.dueAt, now);
  const stateClass =
    item.state === "blocked" ? "is-blocked"
    : item.state === "overdue" ? "is-overdue"
    : item.state === "due" ? "is-due"
    : "is-pending";

  const departure = formatRelativeHe(item.trip.departureAt, now);

  return (
    <div className={`row ${stateClass}`}>
      <div className="title">{item.title}</div>

      <div className={`when${clock ? " when-clock" : ""}`}>
        {clock ? (
          <>
            <span className="num">{utcToZoned(item.dueAt, DISPLAY_TZ).slice(11, 16)}</span>
            <small>{rel.text}</small>
          </>
        ) : (
          <>
            {rel.text}
            <small>{formatAbsoluteHe(item.dueAt, { withTime: true })}</small>
          </>
        )}
      </div>

      <div className="meta">
        <Link href={`/trips/${item.trip.id}`}>
          {item.trip.clientName} · {item.trip.destination}
        </Link>
        <span className="tag">טיסה {departure.text}</span>
        <span className={`tag ${isMoney(item.key) ? "tag-money" : item.audience === "agent" ? "tag-agent" : "tag-client"}`}>
          {isMoney(item.key) ? "כסף" : AUDIENCE_HE[item.audience]}
        </span>
        {item.bornLate && <span className="tag tag-late">נולדה באיחור</span>}
      </div>

      {item.state === "blocked" ? (
        <div className="blocked-note">
          חסום — {item.blockers.map((b) => b.label).join("; ") || "ממתין לתלות"}.{" "}
          <Link href={`/trips/${item.trip.id}#components`}>לפתיחת החסימה</Link>
        </div>
      ) : (
        <MilestoneActions item={item} />
      )}
    </div>
  );
}
