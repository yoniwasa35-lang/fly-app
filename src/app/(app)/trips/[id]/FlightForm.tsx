"use client";

import { useActionState, useEffect } from "react";
import { saveFlightAction, type FlightFormState } from "./actions";

export type FlightDefaults = {
  componentId: string;
  direction: "outbound" | "inbound";
  airlineCode: string;
  flightNumber: string;
  departsAirport: string;
  departsDate: string;
  departsTime: string;
  arrivesAirport: string;
  arrivesDate: string;
  arrivesTime: string;
  baggageAllowance: string;
};

/**
 * פרטי טיסה. בפתיחת התיק חברת התעופה לרוב עדיין לא ידועה, ובלי הטופס הזה
 * טיסה שלא הוזנה ברגע הראשון לא יכלה להיכנס לעולם — וחלונות הצ'ק-אין
 * נגזרים ממנה.
 */
export function FlightForm({
  defaults, airports, airlines, onDone,
}: {
  defaults: FlightDefaults;
  airports: Array<{ iata: string; label: string }>;
  airlines: Array<{ code: string; label: string }>;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<FlightFormState, FormData>(saveFlightAction, {});

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} style={{ padding: "0.6rem 0" }}>
      <input type="hidden" name="componentId" value={defaults.componentId} />
      {state.error && <div className="error" style={{ margin: "0 0 0.6rem" }}>{state.error}</div>}

      <div className="grid2">
        <div className="field">
          <label>כיוון</label>
          <select name="direction" defaultValue={defaults.direction}>
            <option value="outbound">הלוך</option>
            <option value="inbound">חזור</option>
          </select>
        </div>
        <div className="field">
          <label>חברת תעופה</label>
          <select name="airlineCode" defaultValue={defaults.airlineCode} required>
            <option value="" disabled>בחרו</option>
            {airlines.map((a) => (
              <option key={a.code} value={a.code}>{a.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label>מספר טיסה</label>
          <input name="flightNumber" defaultValue={defaults.flightNumber} dir="ltr" placeholder="971" />
        </div>
        <div className="field">
          <label>כבודה</label>
          <input name="baggageAllowance" defaultValue={defaults.baggageAllowance} placeholder="23 ק״ג" />
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label>שדה יציאה</label>
          <select name="departsAirport" defaultValue={defaults.departsAirport} required>
            {airports.map((a) => <option key={a.iata} value={a.iata}>{a.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>שדה נחיתה</label>
          <select name="arrivesAirport" defaultValue={defaults.arrivesAirport} required>
            {airports.map((a) => <option key={a.iata} value={a.iata}>{a.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label>תאריך המראה</label>
          <input name="departsDate" type="date" defaultValue={defaults.departsDate} required />
        </div>
        <div className="field">
          <label>שעת המראה</label>
          <input name="departsTime" type="time" defaultValue={defaults.departsTime} required />
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label>תאריך נחיתה (אם למחרת)</label>
          <input name="arrivesDate" type="date" defaultValue={defaults.arrivesDate} />
        </div>
        <div className="field">
          <label>שעת נחיתה</label>
          <input name="arrivesTime" type="time" defaultValue={defaults.arrivesTime} />
        </div>
      </div>
      <p className="hint" style={{ marginTop: "-0.3rem" }}>
        כל השעות בשעון המקומי של השדה. חלון הצ'ק-אין ייגזר מחברת התעופה ומשעת ההמראה.
      </p>

      <div className="actions">
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "שומר…" : "שמירת הטיסה"}
        </button>
        <button type="button" className="btn-quiet" onClick={onDone}>ביטול</button>
      </div>
    </form>
  );
}
