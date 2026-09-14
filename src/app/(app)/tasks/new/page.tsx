import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatAbsoluteHe } from "@/lib/time/zones";
import { NewTaskForm } from "./NewTaskForm";

export const dynamic = "force-dynamic";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ tripId?: string }>;
}) {
  const sp = await searchParams;

  /*
   * רק נסיעות פתוחות. משימה על נסיעה שהסתיימה כמעט תמיד מעידה על בחירה
   * בשורה הלא נכונה ברשימה.
   */
  const trips = await prisma.trip.findMany({
    where: { status: { in: ["draft", "active", "traveling"] } },
    orderBy: [{ departureAt: "asc" }, { id: "asc" }],
    take: 200,
    select: {
      id: true,
      code: true,
      destination: true,
      departureAt: true,
      client: { select: { name: true } },
    },
  });

  const options = trips.map((t) => ({
    id: t.id,
    label: `${t.client.name} · ${t.destination} · ${formatAbsoluteHe(t.departureAt, { withTime: false })}`,
  }));

  return (
    <>
      <header className="topbar">
        <h1>
          משימה חדשה
          <span className="sub">משימה תמיד שייכת לנסיעה — ככה היא מופיעה בהקשר הנכון</span>
        </h1>
        <Link className="btn" href="/tasks">
          ביטול
        </Link>
      </header>

      {options.length === 0 ? (
        <div className="empty">
          <strong>אין נסיעה פתוחה להוסיף לה משימה.</strong>
          <div style={{ marginTop: "var(--sp-4)" }}>
            <Link className="btn btn-primary" href="/trips/new">
              פתיחת נסיעה
            </Link>
          </div>
        </div>
      ) : (
        <NewTaskForm trips={options} preselected={sp.tripId ?? ""} />
      )}
    </>
  );
}
