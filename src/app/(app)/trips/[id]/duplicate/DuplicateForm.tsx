"use client";

import { useActionState, useState } from "react";
import { duplicateTripAction, type DuplicateState } from "./actions";
import { Icon } from "@/components/Icon";

/** מוסיף ימים לתאריך "YYYY-MM-DD" בלי לגעת באזורי זמן. */
function addDays(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(t)) return "";
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

export function DuplicateForm({
  sourceTripId, nights, travelerCount, previous,
}: {
  sourceTripId: string;
  nights: number;
  travelerCount: number;
  previous: string;
}) {
  const [state, action, pending] = useActionState<DuplicateState, FormData>(duplicateTripAction, {});
  const [departure, setDeparture] = useState("");
  const [returnDate, setReturnDate] = useState("");

  /*
   * בחירת תאריך יציאה מזיזה את החזרה באותו מספר לילות. זה נכון כמעט תמיד
   * כששוכפלה חבילה, ותמיד ניתן לשינוי — אבל הוא חוסך את ההקלדה השנייה.
   */
  function pickDeparture(v: string) {
    setDeparture(v);
    if (v && (!returnDate || returnDate <= v)) setReturnDate(addDays(v, nights));
  }

  return (
    <form action={action}>
      {state.error && (
        <div className="error" role="alert">
          <Icon name="alert" />
          <span>{state.error}</span>
        </div>
      )}

      <input type="hidden" name="sourceTripId" value={sourceTripId} />

      <div className="card">
        <p className="hint">התאריכים הקודמים: {previous}</p>

        <div className="grid2">
          <div className="field">
            <label htmlFor="departureDate">תאריך יציאה</label>
            <input
              id="departureDate"
              name="departureDate"
              type="date"
              required
              value={departure}
              onChange={(e) => pickDeparture(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="returnDate">תאריך חזרה</label>
            <input
              id="returnDate"
              name="returnDate"
              type="date"
              required
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
            />
          </div>
        </div>

        {departure && returnDate && returnDate > departure && (
          <p className="hint">
            {Math.round((Date.parse(returnDate) - Date.parse(departure)) / 86_400_000)} לילות
          </p>
        )}

        {travelerCount > 0 && (
          <label className="checkbox">
            <input type="checkbox" name="copyTravelers" defaultChecked />
            <span>להעתיק את שמות {travelerCount} הנוסעים (בלי מספרי דרכון — הם נבדקים מחדש)</span>
          </label>
        )}

        <button className="btn-primary btn-lg" type="submit" disabled={pending} style={{ width: "100%" }}>
          {pending ? "משכפל…" : "יצירת הנסיעה"}
        </button>
      </div>
    </form>
  );
}
