"use client";

import { useActionState, useState, useTransition } from "react";
import { closeTripAction, updateDetailsAction, type DetailsState } from "./actions";

/**
 * פרטי הלקוח והתיק, וסגירת התיק.
 *
 * טלפון שגוי פירושו שכל ההודעות הולכות לאיבוד, ועד עכשיו לא הייתה דרך
 * לתקן אותו. סגירת התיק מוחקת את מספרי הדרכון כדרישת סעיף 10 — הפונקציה
 * הייתה קיימת בשירות בלי שום כפתור שמפעיל אותה.
 */
export function TripSettingsPanel({
  tripId, clientName, clientPhone, clientEmail, destination, source, notes, status, travelerCount,
}: {
  tripId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  destination: string;
  source: string | null;
  notes: string | null;
  status: string;
  travelerCount: number;
}) {
  const [state, action, saving] = useActionState<DetailsState, FormData>(updateDetailsAction, {});
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const closed = status === "closed";

  return (
    <div className="card">
      <h2>פרטי התיק</h2>
      <p className="hint">
        {clientName} · <span className="num">{clientPhone}</span> · {destination}
        {source && <> · הגיע דרך {source}</>}
      </p>
      {notes && <p className="hint" style={{ whiteSpace: "pre-wrap" }}>{notes}</p>}

      {state.error && <div className="error" style={{ margin: "0.6rem 0" }}>{state.error}</div>}
      {error && <div className="error" style={{ margin: "0.6rem 0" }}>{error}</div>}

      {open ? (
        <form action={action} style={{ marginTop: "0.8rem" }}>
          <input type="hidden" name="tripId" value={tripId} />
          <div className="grid2">
            <div className="field">
              <label htmlFor="clientName">שם הלקוח</label>
              <input id="clientName" name="clientName" defaultValue={clientName} required />
            </div>
            <div className="field">
              <label htmlFor="clientPhone">טלפון</label>
              <input id="clientPhone" name="clientPhone" type="tel" defaultValue={clientPhone} required />
            </div>
          </div>
          <div className="grid2">
            <div className="field">
              <label htmlFor="destination">יעד</label>
              <input id="destination" name="destination" defaultValue={destination} required />
            </div>
            <div className="field">
              <label htmlFor="source">איך הגיע אלינו</label>
              <input id="source" name="source" defaultValue={source ?? ""} placeholder="המלצה, פרסום…" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="notes">הערות פנימיות</label>
            <textarea id="notes" name="notes" defaultValue={notes ?? ""} />
            <p className="hint">לא מוצגות ללקוח.</p>
          </div>
          <div className="actions">
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? "שומר…" : "שמירה"}
            </button>
            <button type="button" className="btn-quiet" onClick={() => setOpen(false)}>סגירה</button>
          </div>
        </form>
      ) : (
        <button style={{ marginTop: "0.5rem" }} onClick={() => setOpen(true)}>עריכת פרטים</button>
      )}

      {!closed && (
        <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "0.8rem" }}>
          {closing ? (
            <div className="error">
              <strong>סגירת התיק מוחקת את מספרי הדרכון של {travelerCount} הנוסעים.</strong>
              <br />
              תאריכי התוקף והשמות נשארים, כי הם נדרשים להזמנה הבאה. את מספרי הדרכון
              אי אפשר לשחזר, והקישור של הלקוח יפסיק לעבוד.
              <div className="actions" style={{ marginTop: "0.6rem" }}>
                <button
                  className="btn-primary"
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    startTransition(async () => {
                      const res = await closeTripAction(tripId);
                      if (res.error) setError(res.error);
                      else setClosing(false);
                    });
                  }}
                >
                  כן, לסגור ולמחוק
                </button>
                <button className="btn-quiet" onClick={() => setClosing(false)}>ביטול</button>
              </div>
            </div>
          ) : (
            <>
              <button className="btn-quiet" onClick={() => setClosing(true)}>סגירת התיק</button>
              <p className="hint">
                סוגר את התיק ומוחק את מספרי הדרכון, כנדרש בסעיף 10 באפיון.
              </p>
            </>
          )}
        </div>
      )}

      {closed && (
        <div className="notice" style={{ margin: "0.8rem 0 0" }}>
          התיק סגור. מספרי הדרכון נמחקו והקישור ללקוח כבר לא פעיל.
        </div>
      )}
    </div>
  );
}
