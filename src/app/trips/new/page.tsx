import { listTemplates } from "@/lib/milestones/template";
import { knownAirlines } from "@/lib/airlines/checkin";
import { allAirports } from "@/lib/time/airports";
import { NewTripForm } from "./NewTripForm";

export const dynamic = "force-dynamic";

export default function NewTripPage() {
  return (
    <>
      <header className="topbar">
        <h1>
          תיק חדש
          <span className="sub">רק מה שאי אפשר לגזור. את השאר משלימים אחר כך.</span>
        </h1>
      </header>
      <NewTripForm
        templates={listTemplates().map((t) => ({ id: t.id, title: t.title }))}
        airports={allAirports().map((a) => ({ iata: a.iata, label: `${a.he} (${a.iata})` }))}
        airlines={knownAirlines()
          .map((a) => ({ code: a.code, label: `${a.name ?? a.code} (${a.code})` }))
          .sort((a, b) => a.label.localeCompare(b.label, "he"))}
      />
    </>
  );
}
