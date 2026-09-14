"use client";

import { useState, useTransition } from "react";
import {
  addTravelerAction,
  removeTravelerAction,
  revealPassportAction,
  updateTravelerAction,
} from "@/app/actions";

export type TravelerRow = {
  id: string;
  firstNameLatin: string;
  lastNameLatin: string;
  displayNameHe: string | null;
  passportLast4: string | null;
  passportExpiry: string | null;
  passportCountry: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  isLead: boolean;
  /** האם תוקף הדרכון עומד בדרישת היעד. */
  expiryOk: boolean | null;
};

/**
 * נוסעים. בלי המסך הזה שרשרת שלמה באפיון לא יכולה לפעול: בדיקת תוקף
 * הדרכון (סעיף 5), אבן הדרך של קליטת הפרטים, והמשתנה {{נוסעים}} בערכת
 * המסמכים.
 *
 * מספר הדרכון מוצג כארבע ספרות אחרונות בלבד. הצגת המספר המלא היא פעולה
 * מפורשת, כדי שהוא לא יישב סתם על המסך.
 */
export function TravelersPanel({
  tripId, travelers, requiredUntil,
}: {
  tripId: string;
  travelers: TravelerRow[];
  requiredUntil: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "שגיאה");
      else { setEditing(null); setAdding(false); }
    });
  };

  return (
    <div className="card">
      <h2>נוסעים</h2>
      <p className="hint">
        השמות חייבים להיות בדיוק כמו בדרכון. תוקף נדרש עד{" "}
        <span className="num">{requiredUntil}</span>.
      </p>

      {error && <div className="error" style={{ margin: "0.6rem 0" }}>{error}</div>}

      {travelers.length === 0 && !adding && (
        <p className="hint" style={{ color: "var(--due)" }}>
          עדיין לא הוזנו נוסעים. בלעדיהם אי אפשר לבדוק תוקף דרכונים, וערכת
          מסמכי הנסיעה לא תישלח.
        </p>
      )}

      {travelers.map((t) =>
        editing === t.id ? (
          <TravelerForm
            key={t.id}
            traveler={t}
            pending={pending}
            onCancel={() => setEditing(null)}
            onSubmit={(values) => run(() => updateTravelerAction(t.id, values))}
          />
        ) : (
          <div key={t.id} className="traveler-row">
            <div>
              <div className="traveler-name">
                <span className="ltr">{t.firstNameLatin} {t.lastNameLatin}</span>
                {t.isLead && <span className="tag">איש קשר</span>}
              </div>
              <div className="hint">
                {t.displayNameHe && <>{t.displayNameHe} · </>}
                דרכון{" "}
                {revealed[t.id] ? (
                  <span className="num">{revealed[t.id]}</span>
                ) : t.passportLast4 ? (
                  <>
                    <span className="num">•••{t.passportLast4}</span>{" "}
                    <button
                      className="btn-quiet inline"
                      onClick={() =>
                        startTransition(async () => {
                          const res = await revealPassportAction(t.id);
                          if (res.ok) setRevealed((r) => ({ ...r, [t.id]: res.value }));
                          else setError(res.error);
                        })
                      }
                    >
                      הצגה
                    </button>
                  </>
                ) : (
                  <span style={{ color: "var(--due)" }}>חסר</span>
                )}
                {" · תוקף "}
                {t.passportExpiry ? (
                  <span className={`num ${t.expiryOk === false ? "expiry-bad" : ""}`}>
                    {t.passportExpiry}
                  </span>
                ) : (
                  <span style={{ color: "var(--due)" }}>חסר</span>
                )}
                {t.phone && <> · <span className="num">{t.phone}</span></>}
              </div>
            </div>
            <div className="actions">
              <button className="btn-quiet" onClick={() => setEditing(t.id)}>עריכה</button>
              <button
                className="btn-quiet"
                disabled={pending}
                onClick={() => run(() => removeTravelerAction(t.id))}
              >
                הסרה
              </button>
            </div>
          </div>
        ),
      )}

      {adding ? (
        <TravelerForm
          pending={pending}
          onCancel={() => setAdding(false)}
          onSubmit={(values) => run(() => addTravelerAction(tripId, values))}
        />
      ) : (
        <button style={{ marginTop: "0.7rem" }} onClick={() => { setAdding(true); setEditing(null); }}>
          הוספת נוסע
        </button>
      )}
    </div>
  );
}

type FormValues = {
  firstNameLatin: string;
  lastNameLatin: string;
  displayNameHe: string;
  passportNumber: string;
  passportExpiry: string;
  passportCountry: string;
  dateOfBirth: string;
  phone: string;
  isLead: boolean;
};

function TravelerForm({
  traveler, pending, onSubmit, onCancel,
}: {
  traveler?: TravelerRow;
  pending: boolean;
  onSubmit: (values: FormValues) => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="traveler-form"
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        onSubmit({
          firstNameLatin: String(d.get("firstNameLatin") ?? ""),
          lastNameLatin: String(d.get("lastNameLatin") ?? ""),
          displayNameHe: String(d.get("displayNameHe") ?? ""),
          passportNumber: String(d.get("passportNumber") ?? ""),
          passportExpiry: String(d.get("passportExpiry") ?? ""),
          passportCountry: String(d.get("passportCountry") ?? ""),
          dateOfBirth: String(d.get("dateOfBirth") ?? ""),
          phone: String(d.get("phone") ?? ""),
          isLead: d.get("isLead") === "on",
        });
      }}
    >
      <div className="grid2">
        <div className="field">
          <label>שם פרטי כמו בדרכון</label>
          <input name="firstNameLatin" defaultValue={traveler?.firstNameLatin} required
            dir="ltr" autoComplete="off" placeholder="DANA" />
        </div>
        <div className="field">
          <label>שם משפחה כמו בדרכון</label>
          <input name="lastNameLatin" defaultValue={traveler?.lastNameLatin} required
            dir="ltr" autoComplete="off" placeholder="COHEN" />
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label>מספר דרכון</label>
          <input name="passportNumber" dir="ltr" autoComplete="off"
            placeholder={traveler?.passportLast4 ? `•••${traveler.passportLast4} — השאירו ריק כדי לא לשנות` : ""} />
        </div>
        <div className="field">
          <label>תוקף דרכון</label>
          <input name="passportExpiry" type="date" defaultValue={traveler?.passportExpiry ?? ""} />
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label>שם בעברית (לא חובה)</label>
          <input name="displayNameHe" defaultValue={traveler?.displayNameHe ?? ""} autoComplete="off" />
        </div>
        <div className="field">
          <label>טלפון (לא חובה)</label>
          <input name="phone" type="tel" defaultValue={traveler?.phone ?? ""} autoComplete="off" />
        </div>
      </div>

      <label className="checkbox">
        <input type="checkbox" name="isLead" defaultChecked={traveler?.isLead ?? false} />
        <span>איש הקשר בתיק — אליו נשלחות ההודעות</span>
      </label>

      <div className="actions">
        <button className="btn-primary" type="submit" disabled={pending}>שמירה</button>
        <button type="button" className="btn-quiet" onClick={onCancel}>ביטול</button>
      </div>
    </form>
  );
}
