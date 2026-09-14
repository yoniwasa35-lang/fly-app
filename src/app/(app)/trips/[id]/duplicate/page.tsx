import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatAbsoluteHe } from "@/lib/time/zones";
import { nightsBetween } from "@/lib/trips/summary";
import { DuplicateForm } from "./DuplicateForm";

export const dynamic = "force-dynamic";

export default async function DuplicateTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    select: {
      id: true,
      destination: true,
      departureAt: true,
      returnAt: true,
      departureAirport: true,
      returnAirport: true,
      priceToClient: true,
      client: { select: { name: true } },
      _count: { select: { travelers: true } },
    },
  });
  if (!trip) notFound();

  const nights = nightsBetween(trip.departureAt, trip.returnAt);

  return (
    <>
      <header className="topbar">
        <h1>
          שכפול נסיעה
          <span className="sub">
            {trip.client.name} · {trip.destination} · {nights} לילות
          </span>
        </h1>
        <Link className="btn" href={`/trips/${trip.id}`}>
          ביטול
        </Link>
      </header>

      <div className="notice">
        <span>
          היעד, השדות, חברות התעופה והמחיר יועתקו. הגבייה מתחילה מאפס, ותוקפי הדרכונים
          ייבדקו מחדש — נסיעה קודמת היא לא הוכחה שהדרכון עדיין בתוקף.
        </span>
      </div>

      <DuplicateForm
        sourceTripId={trip.id}
        nights={nights}
        travelerCount={trip._count.travelers}
        previous={`${formatAbsoluteHe(trip.departureAt, { withTime: false })} – ${formatAbsoluteHe(trip.returnAt, { withTime: false })}`}
      />
    </>
  );
}
