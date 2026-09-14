import Link from "next/link";
import { getTimeline, PAST_WINDOW_DAYS, WINDOW_OPTIONS } from "@/lib/queue/timeline";
import { formatAbsoluteHe } from "@/lib/time/zones";
import { TimelineBoard } from "./TimelineBoard";
import { TripFilters } from "./TripFilters";

export const dynamic = "force-dynamic";

type Search = {
  q?: string;
  window?: string;
  hot?: string;
  status?: string;
  page?: string;
};

const PAGE_SIZE = 40;

export default async function TripsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;

  const windowDays = WINDOW_OPTIONS.includes(Number(sp.window) as (typeof WINDOW_OPTIONS)[number])
    ? Number(sp.window)
    : 90;
  const page = Math.max(0, Number(sp.page) || 0);
  const status = sp.status === "traveling" || sp.status === "all" ? sp.status : "open";

  const timeline = await getTimeline({
    query: sp.q,
    windowDays,
    onlyHot: sp.hot === "1",
    status,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const buildHref = (patch: Partial<Search>) => {
    const params = new URLSearchParams();
    const merged = { ...sp, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "0" && !(k === "page" && v === "0")) params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `/trips?${qs}` : "/trips";
  };

  return (
    <>
      <header className="topbar">
        <h1>
          כל התיקים
          <span className="sub">
            {timeline.total} תיקים בחלון של {windowDays} יום
            {timeline.counts.hot > 0 && <> · {timeline.counts.hot} דורשים טיפול</>}
          </span>
        </h1>
        <Link className="btn" href="/trips/new">תיק חדש</Link>
      </header>

      <TripFilters
        q={sp.q ?? ""}
        windowDays={windowDays}
        hot={sp.hot === "1"}
        status={status}
      />

      {timeline.rows.length === 0 ? (
        <div className="empty">
          <strong>אין תיקים שתואמים לסינון.</strong>
          {timeline.total === 0 && sp.q
            ? "אף תיק לא תואם את החיפוש."
            : "נסו להרחיב את חלון הזמן או לנקות את הסינון."}
          <div style={{ marginTop: "0.8rem" }}>
            <Link className="btn" href="/trips">ניקוי סינון</Link>
          </div>
        </div>
      ) : (
        <>
          <TimelineBoard timeline={timeline} pastDays={PAST_WINDOW_DAYS} />

          <div className="tl-legend">
            <span><i className="tl-dot s-overdue" /> עבר מועד</span>
            <span><i className="tl-dot s-due" /> לפעולה</span>
            <span><i className="tl-dot s-blocked" /> חסום</span>
            <span><i className="tl-dot s-pending" /> עתידי</span>
            <span><i className="departure-key" /> יום הטיסה</span>
          </div>

          <p className="hint" style={{ padding: "0 1rem" }}>
            הציר מתחיל {formatAbsoluteHe(timeline.windowStart, { withTime: false })} ומשתרע על{" "}
            {timeline.windowDays} יום. נקודה אחת יכולה לייצג כמה אבני דרך באותו יום.
          </p>

          {(page > 0 || timeline.more > 0) && (
            <div className="actions" style={{ padding: "0 1rem 1rem", justifyContent: "space-between" }}>
              {page > 0 ? (
                <Link className="btn" href={buildHref({ page: String(page - 1) })}>הקודמים</Link>
              ) : <span />}
              {timeline.more > 0 && (
                <Link className="btn" href={buildHref({ page: String(page + 1) })}>
                  עוד {Math.min(PAGE_SIZE, timeline.more)} תיקים
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
