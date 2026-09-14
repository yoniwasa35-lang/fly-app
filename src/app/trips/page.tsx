import Link from "next/link";
import { prisma } from "@/lib/db";
import { isOpenState, TRIP_STATUS_HE, type TripStatus } from "@/lib/domain/types";
import { formatAbsoluteHe, formatRelativeHe } from "@/lib/time/zones";

export const dynamic = "force-dynamic";

/**
 * רשימת התיקים. תצוגת ציר הזמן האופקית המלאה (סעיף 8.2) היא שלב 3;
 * כאן יש רשימה ממוינת לפי יום הטיסה, שמספיקה כדי לנווט לתיק.
 */
export default async function TripsPage() {
  const trips = await prisma.trip.findMany({
    where: { status: { in: ["active", "traveling"] } },
    orderBy: { departureAt: "asc" },
    include: {
      client: { select: { name: true } },
      milestones: { where: { state: { in: ["due", "overdue", "blocked", "pending"] } }, select: { state: true } },
    },
    take: 200,
  });

  const now = new Date();

  return (
    <>
      <header className="topbar">
        <h1>
          כל התיקים
          <span className="sub">{trips.length} תיקים פתוחים, לפי יום הטיסה</span>
        </h1>
        <Link className="btn" href="/trips/new">תיק חדש</Link>
      </header>

      {trips.length === 0 ? (
        <div className="empty">
          <strong>אין עדיין תיקים.</strong>
          <Link className="btn" href="/trips/new" style={{ marginTop: "0.8rem" }}>פתיחת תיק ראשון</Link>
        </div>
      ) : (
        <div className="stack" style={{ marginTop: "1rem" }}>
          {trips.map((t) => {
            const open = t.milestones.filter((m) => isOpenState(m.state));
            const overdue = open.filter((m) => m.state === "overdue").length;
            const blocked = open.filter((m) => m.state === "blocked").length;
            const rel = formatRelativeHe(t.departureAt, now);
            return (
              <Link key={t.id} href={`/trips/${t.id}`} style={{ textDecoration: "none" }}>
                <div className={`row ${overdue > 0 ? "is-overdue" : blocked > 0 ? "is-blocked" : "is-pending"}`}>
                  <div className="when">
                    {rel.text}
                    <small>{formatAbsoluteHe(t.departureAt, { withTime: false })}</small>
                  </div>
                  <div className="title">{t.client.name} · {t.destination}</div>
                  <div className="meta">
                    <span className="num">{t.code}</span>
                    <span className="tag">{TRIP_STATUS_HE[t.status as TripStatus]}</span>
                    {overdue > 0 && <span className="tag tag-overdue">{overdue} עברו מועד</span>}
                    {blocked > 0 && <span className="tag tag-blocked">{blocked} חסומות</span>}
                    {overdue === 0 && blocked === 0 && <span className="tag tag-done">נקי</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
