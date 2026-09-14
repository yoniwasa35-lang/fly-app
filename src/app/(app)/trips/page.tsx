import Link from "next/link";
import { getTimeline, PAST_WINDOW_DAYS } from "@/lib/queue/timeline";
import { formatAbsoluteHe, formatRelativeHe } from "@/lib/time/zones";
import { TRIP_STATUS_HE } from "@/lib/domain/types";
import { Icon } from "@/components/Icon";
import { BrandMark } from "@/components/Brand";
import { TimelineBoard } from "./TimelineBoard";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

const TABS = [
  { key: "upcoming", label: "קרובות", status: "open" as const },
  { key: "traveling", label: "בטיול עכשיו", status: "traveling" as const },
  { key: "done", label: "הסתיימו", status: "done" as const },
];

/**
 * "נסיעות" — סעיף 8.2.
 *
 * הרשימה היא התצוגה הראשית, כי זו השאלה שנשאלת בפועל: מי יוצא, לאן,
 * ומתי. ציר הזמן האופקי שהאפיון מבקש נשאר, אבל מתחת למתג — הוא מצוין
 * לסריקה של עשרות תיקים במבט, וגרוע כשרוצים לקרוא שורה אחת.
 */
export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const q = sp.q?.trim() ?? "";
  const page = Math.max(0, Number(sp.page) || 0);

  const timeline = await getTimeline({
    query: q,
    windowDays: 180,
    status: tab.status,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const href = (patch: { tab?: string; page?: string }) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    const t = patch.tab ?? tab.key;
    if (t !== "upcoming") p.set("tab", t);
    if (patch.page && patch.page !== "0") p.set("page", patch.page);
    const s = p.toString();
    return s ? `/trips?${s}` : "/trips";
  };

  const now = timeline.now;

  return (
    <>
      <header className="topbar">
        <BrandMark className="topbar-brand" />
        <h1>
          נסיעות
          <span className="sub">
            {timeline.total} {timeline.total === 1 ? "נסיעה" : "נסיעות"}
            {timeline.counts.hot > 0 && <> · {timeline.counts.hot} דורשות טיפול</>}
          </span>
        </h1>
        <Link className="btn btn-primary" href="/trips/new">
          <Icon name="plus" />
          <span>נסיעה</span>
        </Link>
      </header>

      <div className="tabs" role="tablist" aria-label="סינון נסיעות">
        {TABS.map((t) => (
          <Link
            key={t.key}
            className="tab"
            href={href({ tab: t.key, page: "0" })}
            aria-selected={t.key === tab.key}
            role="tab"
          >
            {t.label}
          </Link>
        ))}
      </div>

      <form className="searchbar" action="/trips" method="get" role="search">
        {tab.key !== "upcoming" && <input type="hidden" name="tab" value={tab.key} />}
        <Icon name="search" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="חיפוש לפי לקוח, יעד או מספר תיק"
          aria-label="חיפוש נסיעה"
        />
        {q && (
          <Link className="btn-quiet" href={href({ page: "0" })}>
            ניקוי
          </Link>
        )}
      </form>

      {timeline.rows.length === 0 ? (
        <div className="empty">
          <Icon name="trips" />
          <strong>
            {q
              ? "אין נסיעה שתואמת את החיפוש."
              : tab.key === "traveling"
                ? "אף לקוח לא בטיול כרגע."
                : tab.key === "done"
                  ? "עוד לא הסתיימה נסיעה."
                  : "אין נסיעות קרובות."}
          </strong>
          {q ? "נסו שם לקוח, יעד או מספר תיק." : "כל נסיעה שתפתחו תופיע כאן."}
        </div>
      ) : (
        <>
          <div className="stack">
            {timeline.rows.map((t) => {
              const rel = formatRelativeHe(t.departureAt, now);
              const needs = t.overdue + t.blocked;
              return (
                <Link key={t.id} className="trip-card" href={`/trips/${t.id}`}>
                  <span className="trip-card-head">
                    <strong>{t.clientName}</strong>
                    <span className="trip-card-dest">{t.destination}</span>
                  </span>

                  <span className="trip-card-when">
                    {formatAbsoluteHe(t.departureAt, { withTime: false })} –{" "}
                    {formatAbsoluteHe(t.returnAt, { withTime: false })}
                  </span>

                  <span className="trip-card-tags">
                    {t.status === "traveling" ? (
                      <span className="tag tag-done">בטיול עכשיו</span>
                    ) : tab.key === "done" ? (
                      <span className="tag">{TRIP_STATUS_HE[t.status]}</span>
                    ) : (
                      <span className="tag tag-client">{rel.text}</span>
                    )}
                    {needs > 0 && <span className="tag tag-overdue">{needs} דורשות טיפול</span>}
                    {needs === 0 && t.open > 0 && tab.key !== "done" && (
                      <span className="tag">{t.open} אבני דרך פתוחות</span>
                    )}
                    <span className="tag tag-agent num">{t.code}</span>
                  </span>

                  <Icon name="chevron" className="menu-go" />
                </Link>
              );
            })}
          </div>

          {/* ציר הזמן של סעיף 8.2 — טוב לסריקה רוחבית, ולכן מתקפל ולא ראשי */}
          {tab.key !== "done" && (
            <details className="collapse">
              <summary>
                תצוגת ציר זמן
                <span className="hint">כל הנסיעות על ציר אחד, לפי קרבת הטיסה</span>
              </summary>
              <TimelineBoard timeline={timeline} pastDays={PAST_WINDOW_DAYS} />
              <div className="tl-legend">
                <span>
                  <i className="tl-dot s-overdue" /> עבר מועד
                </span>
                <span>
                  <i className="tl-dot s-due" /> לפעולה
                </span>
                <span>
                  <i className="tl-dot s-blocked" /> חסום
                </span>
                <span>
                  <i className="tl-dot s-pending" /> עתידי
                </span>
                <span>
                  <i className="departure-key" /> יום הטיסה
                </span>
              </div>
            </details>
          )}
        </>
      )}

      {(page > 0 || timeline.more > 0) && (
        <div className="pager">
          {page > 0 ? (
            <Link className="btn" href={href({ page: String(page - 1) })}>
              הקודמות
            </Link>
          ) : (
            <span />
          )}
          {timeline.more > 0 && (
            <Link className="btn" href={href({ page: String(page + 1) })}>
              עוד {Math.min(PAGE_SIZE, timeline.more)}
            </Link>
          )}
        </div>
      )}
    </>
  );
}
