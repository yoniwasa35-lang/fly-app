"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { addFlightComponentAction } from "./actions";
import { FlightForm, type FlightDefaults } from "./FlightForm";

export type FlightRow = {
  componentId: string;
  direction: "outbound" | "inbound";
  /** מה שמוצג כשלא עורכים. ריק כשהטיסה עוד לא מולאה. */
  line: string | null;
  dateLabel: string | null;
  flightNumber: string | null;
  baggage: string | null;
  checkinDone: boolean;
  defaults: FlightDefaults;
};

/**
 * הטיסות, בתוך החלון שלהן.
 *
 * קודם החלון הזה היה לקריאה בלבד והפנה את הסוכן ל"פרטי ההזמנה" בתפריט —
 * מקום שאי אפשר היה למצוא. הפניה למסך אחר היא כמעט תמיד הסימן שהפעולה
 * יושבת במקום הלא נכון, ולא שההסבר לא היה ברור מספיק.
 */
export function FlightsPanel({
  tripId, flights, airports, airlines,
}: {
  tripId: string;
  flights: FlightRow[];
  airports: Array<{ iata: string; label: string }>;
  airlines: Array<{ code: string; label: string }>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const has = (d: "outbound" | "inbound") => flights.some((f) => f.direction === d);

  function add(direction: "outbound" | "inbound") {
    setError(null);
    startTransition(async () => {
      const res = await addFlightComponentAction(tripId, direction);
      if (res.error) setError(res.error);
      // הטופס נפתח ברגע שהרכיב החדש מגיע מהשרת.
      else if (res.componentId) setEditing(res.componentId);
    });
  }

  return (
    <>
      {error && (
        <div className="error" role="alert" style={{ margin: "0 0 var(--sp-4)" }}>
          <Icon name="alert" />
          <span>{error}</span>
        </div>
      )}

      {flights.length === 0 && (
        <p className="hint" style={{ marginBottom: "var(--sp-4)" }}>
          עוד לא הוזנו טיסות. אפשר להוסיף אותן כאן — חלונות הצ׳ק-אין ייווצרו לבד
          מחברת התעופה ומשעת ההמראה.
        </p>
      )}

      {flights.map((f) => (
        <article key={f.componentId} className="leg">
          <header className="leg-head">
            <strong>{f.direction === "outbound" ? "הלוך" : "חזור"}</strong>
            {f.dateLabel && <span className="c-muted">{f.dateLabel}</span>}
            {f.checkinDone && <span className="tag tag-done">צ׳ק-אין בוצע</span>}
            <button
              type="button"
              className="btn-quiet leg-edit"
              onClick={() => setEditing(editing === f.componentId ? null : f.componentId)}
            >
              {editing === f.componentId ? "סגירה" : f.line ? "עריכה" : "מילוי פרטים"}
            </button>
          </header>

          {editing === f.componentId ? (
            <FlightForm
              defaults={f.defaults}
              airports={airports}
              airlines={airlines}
              onDone={() => setEditing(null)}
            />
          ) : f.line ? (
            <>
              <p className="leg-line">{f.line}</p>
              <p className="hint">
                {f.flightNumber && <span className="ltr">{f.flightNumber}</span>}
                {f.flightNumber && f.baggage && " · "}
                {f.baggage}
              </p>
            </>
          ) : (
            <p className="hint">הטיסה נוצרה אבל עוד לא מולאה.</p>
          )}
        </article>
      ))}

      <div className="wa-actions" style={{ marginTop: "var(--sp-5)" }}>
        <button type="button" onClick={() => add("outbound")} disabled={pending}>
          <Icon name="plus" />
          <span>{has("outbound") ? "עוד טיסת הלוך" : "הוספת טיסת הלוך"}</span>
        </button>
        <button type="button" onClick={() => add("inbound")} disabled={pending}>
          <Icon name="plus" />
          <span>{has("inbound") ? "עוד טיסת חזור" : "הוספת טיסת חזור"}</span>
        </button>
      </div>
    </>
  );
}
