"use client";

import { useActionState, useState } from "react";
import { changeDepartureAction, type ChangeDepartureState } from "./actions";

/**
 * סעיף 6.5 ו-12: שינוי תאריך טיסה מזיז את כל אבני הדרך הפתוחות ומציג סיכום.
 * הסיכום הוא חלק מהדרישה, לא קישוט — בלעדיו הסוכן לא יודע מה השתנה לו בתור.
 */
export function DepartureEditor(props: {
  tripId: string;
  departureDate: string;
  departureTime: string;
  departureAirport: string;
  returnDate: string;
  returnTime: string;
  returnAirport: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ChangeDepartureState, FormData>(
    changeDepartureAction,
    {},
  );

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("he-IL", {
      timeZone: "Asia/Jerusalem",
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });

  const deltaText = (minutes: number) => {
    const days = Math.round(minutes / (60 * 24));
    if (days === 0) {
      const hours = Math.round(minutes / 60);
      return hours > 0 ? `+${hours} שעות` : `${hours} שעות`;
    }
    return days > 0 ? `+${days} ימים` : `${days} ימים`;
  };

  return (
    <div className="card">
      <h2>מועדי הנסיעה</h2>
      <p className="hint">
        יציאה מ-{props.departureAirport} ב-<span className="num">{props.departureDate} {props.departureTime}</span> ·
        חזרה מ-{props.returnAirport} ב-<span className="num">{props.returnDate} {props.returnTime}</span>
        <br />
        השעות בשעון השדה. שינוי כאן מזיז את כל אבני הדרך שטרם טופלו.
      </p>

      {state.error && <div className="error" style={{ margin: "0.6rem 0 0" }}>{state.error}</div>}

      {state.summary && (
        <div className="notice" style={{ margin: "0.7rem 0 0" }}>
          <strong>
            {state.summary.movedCount === 0
              ? "שום אבן דרך לא זזה."
              : `${state.summary.movedCount} אבני דרך זזו.`}
          </strong>
          {state.summary.createdCount > 0 && <> נוצרו {state.summary.createdCount} חדשות.</>}
          {state.summary.removedCount > 0 && <> הוסרו {state.summary.removedCount}.</>}
          {state.summary.frozenCount > 0 && <> {state.summary.frozenCount} שכבר טופלו נשארו במקומן.</>}
          {state.summary.moves.length > 0 && (
            <ul style={{ margin: "0.5rem 0 0", paddingInlineStart: "1.1rem" }}>
              {state.summary.moves.slice(0, 12).map((m) => (
                <li key={m.title}>
                  {m.title}: <span className="num">{fmt(m.from)}</span> ←{" "}
                  <span className="num">{fmt(m.to)}</span> ({deltaText(m.deltaMinutes)})
                </li>
              ))}
              {state.summary.moves.length > 12 && <li>ועוד {state.summary.moves.length - 12}…</li>}
            </ul>
          )}
        </div>
      )}

      {!open ? (
        <button style={{ marginTop: "0.7rem" }} onClick={() => setOpen(true)}>שינוי תאריכים</button>
      ) : (
        <form action={formAction} style={{ marginTop: "0.8rem" }}>
          <input type="hidden" name="tripId" value={props.tripId} />
          <div className="grid2">
            <div className="field">
              <label htmlFor="departureDate">תאריך יציאה</label>
              <input id="departureDate" name="departureDate" type="date" defaultValue={props.departureDate} required />
            </div>
            <div className="field">
              <label htmlFor="departureTime">שעת יציאה</label>
              <input id="departureTime" name="departureTime" type="time" defaultValue={props.departureTime} required />
            </div>
          </div>
          <div className="grid2">
            <div className="field">
              <label htmlFor="returnDate">תאריך חזרה</label>
              <input id="returnDate" name="returnDate" type="date" defaultValue={props.returnDate} required />
            </div>
            <div className="field">
              <label htmlFor="returnTime">שעת חזרה</label>
              <input id="returnTime" name="returnTime" type="time" defaultValue={props.returnTime} required />
            </div>
          </div>
          <div className="actions">
            <button className="btn-primary" type="submit" disabled={pending}>
              {pending ? "מעדכן…" : "עדכון ודחיפת אבני הדרך"}
            </button>
            <button type="button" className="btn-quiet" onClick={() => setOpen(false)}>סגירה</button>
          </div>
        </form>
      )}
    </div>
  );
}
