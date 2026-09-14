import { listTemplates } from "@/lib/milestones/template";
import { knownAirlines } from "@/lib/airlines/checkin";
import { allAirports } from "@/lib/time/airports";
import { getReturningClient } from "@/lib/trips/service";
import { NewTripForm } from "./NewTripForm";

export const dynamic = "force-dynamic";

export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;

  // הגעה ישירה מכרטיס הלקוח: אין מה לחפש, הלקוח כבר ידוע. זה החוליה
  // שהופכת "לקוח נוצר פעם אחת" מהצהרה במסד למשהו שמרגישים בזרימה.
  const preselected = clientId ? await getReturningClient(clientId) : null;

  return (
    <>
      <header className="topbar">
        <h1>
          {preselected ? `נסיעה ל${preselected.name}` : "נסיעה חדשה"}
          <span className="sub">רק מה שאי אפשר לגזור. את השאר משלימים אחר כך.</span>
        </h1>
      </header>
      <NewTripForm
        preselected={preselected}
        templates={listTemplates().map((t) => ({ id: t.id, title: t.title }))}
        airports={allAirports().map((a) => ({ iata: a.iata, label: `${a.he} (${a.iata})` }))}
        airlines={knownAirlines()
          .map((a) => ({ code: a.code, label: `${a.name ?? a.code} (${a.code})` }))
          .sort((a, b) => a.label.localeCompare(b.label, "he"))}
      />
    </>
  );
}
