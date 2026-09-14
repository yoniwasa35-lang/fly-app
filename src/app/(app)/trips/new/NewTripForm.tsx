"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { createTripAction, findClientsAction, type NewTripState } from "./actions";
import type { ReturningClient } from "@/lib/trips/service";

/**
 * פתיחת תיק. סעיף 4 אומר מפורשות: "אם יצירת תיק דורשת מילוי 20 שדות,
 * המערכת תינטש תוך שבועיים."
 *
 * לכן גלוי רק מה שבאמת ידוע ברגע התשלום — לקוח, יעד, שני תאריכים ומחיר.
 * פרטי הטיסה לרוב עוד לא חזרו מהספק באותו רגע, והכסף המלא מתברר אחר כך;
 * שניהם מקופלים ואפשר להשלים אותם מהתיק בכל שלב.
 *
 * ולקוח חוזר: הפרטים והדרכונים כבר במערכת מהתיק הקודם. הקלדה מחדש שלהם
 * היא גם בזבוז וגם מקור לטעויות.
 */
export function NewTripForm({
  templates, airports, airlines, preselected = null,
}: {
  templates: Array<{ id: string; title: string }>;
  airports: Array<{ iata: string; label: string }>;
  airlines: Array<{ code: string; label: string }>;
  /** לקוח שהגיעו איתו מכרטיס הלקוח. הטופס נפתח עליו, בלי חיפוש. */
  preselected?: ReturningClient | null;
}) {
  const [state, formAction, pending] = useActionState<NewTripState, FormData>(createTripAction, {});
  const today = new Date().toISOString().slice(0, 10);

  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<ReturningClient[]>([]);
  const [picked, setPicked] = useState<ReturningClient | null>(preselected);
  const [, startTransition] = useTransition();

  const [showFlights, setShowFlights] = useState(false);
  const [showMoney, setShowMoney] = useState(false);

  useEffect(() => {
    if (picked || search.trim().length < 2) { setMatches([]); return; }
    const timer = setTimeout(() => {
      startTransition(async () => setMatches(await findClientsAction(search)));
    }, 300);
    return () => clearTimeout(timer);
  }, [search, picked]);

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      <div className="card">
        <h2>לקוח</h2>

        {picked ? (
          <>
            <input type="hidden" name="existingClientId" value={picked.id} />
            <input type="hidden" name="clientName" value={picked.name} />
            <input type="hidden" name="clientPhone" value={picked.phone} />
            <div className="returning">
              <div>
                <strong>{picked.name}</strong> · <span className="num">{picked.phone}</span>
                <div className="hint">
                  לקוח חוזר · {picked.tripCount} תיקים
                  {picked.lastDestination && <> · אחרון ל{picked.lastDestination}</>}
                </div>
              </div>
              <button type="button" className="btn-quiet" onClick={() => { setPicked(null); setSearch(""); }}>
                החלפה
              </button>
            </div>
            {picked.travelerCount > 0 && (
              <label className="checkbox" style={{ marginTop: "0.6rem" }}>
                <input type="checkbox" name="copyTravelers" defaultChecked />
                <span>
                  להעתיק את {picked.travelerCount} הנוסעים מהתיק הקודם, כולל הדרכונים
                </span>
              </label>
            )}
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="clientName">שם</label>
              <input
                id="clientName" name="clientName" required autoFocus autoComplete="off"
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="התחילו להקליד — לקוח חוזר יימצא לבד"
              />
              {matches.length > 0 && (
                <ul className="client-matches">
                  {matches.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => setPicked(c)}>
                        <strong>{c.name}</strong> <span className="num">{c.phone}</span>
                        <span className="hint">
                          {c.tripCount} תיקים
                          {c.travelerCount > 0 && ` · ${c.travelerCount} נוסעים שמורים`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="field">
              <label htmlFor="clientPhone">טלפון</label>
              <input id="clientPhone" name="clientPhone" type="tel" inputMode="tel" required
                placeholder="050-0000000" />
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>הנסיעה</h2>
        <div className="field">
          <label htmlFor="destination">יעד</label>
          <input id="destination" name="destination" required placeholder="רודוס" autoComplete="off" />
        </div>

        <div className="grid2">
          <div className="field">
            <label htmlFor="departureDate">תאריך יציאה</label>
            <input id="departureDate" name="departureDate" type="date" required />
          </div>
          <div className="field">
            <label htmlFor="returnDate">תאריך חזרה</label>
            <input id="returnDate" name="returnDate" type="date" required />
          </div>
        </div>

        <div className="field">
          <label htmlFor="returnAirport">שדה היעד</label>
          <select id="returnAirport" name="returnAirport" defaultValue="" required>
            <option value="" disabled>בחרו שדה</option>
            {airports.map((a) => (
              <option key={a.iata} value={a.iata}>{a.label}</option>
            ))}
          </select>
          <p className="hint">נדרש כדי לדעת באיזה שעון לחשב את הצ׳ק-אין לטיסת החזור.</p>
        </div>

        <input type="hidden" name="departureAirport" value="TLV" />
        <input type="hidden" name="bookedDate" value={today} />
        {templates.length === 1 ? (
          <input type="hidden" name="templateId" value={templates[0].id} />
        ) : (
          <div className="field">
            <label htmlFor="templateId">סוג הנסיעה</label>
            <select id="templateId" name="templateId" defaultValue={templates[0]?.id}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label htmlFor="priceToClient">מחיר ללקוח</label>
          <input id="priceToClient" name="priceToClient" type="number" min="0" step="1" defaultValue="0" />
        </div>
      </div>

      {/* כל מה שלרוב עוד לא ידוע ברגע התשלום */}
      <details className="collapse form-more" open={showFlights} onToggle={(e) => setShowFlights(e.currentTarget.open)}>
        <summary>
          פרטי טיסה
          <span className="hint">חברה, מספרי טיסה ושעות. אפשר להשלים אחר כך מהתיק.</span>
        </summary>
        <div style={{ padding: "0 0.85rem 0.85rem" }}>
          <div className="grid2">
            <div className="field">
              <label htmlFor="departureTime">שעת יציאה</label>
              <input id="departureTime" name="departureTime" type="time" />
            </div>
            <div className="field">
              <label htmlFor="returnTime">שעת חזרה</label>
              <input id="returnTime" name="returnTime" type="time" />
            </div>
          </div>
          <div className="grid2">
            <div className="field">
              <label htmlFor="outboundAirline">חברה, הלוך</label>
              <select id="outboundAirline" name="outboundAirline" defaultValue="">
                <option value="">— עדיין לא ידוע —</option>
                {airlines.map((a) => <option key={a.code} value={a.code}>{a.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="outboundFlightNumber">מספר טיסה</label>
              <input id="outboundFlightNumber" name="outboundFlightNumber" inputMode="numeric" />
            </div>
          </div>
          <div className="grid2">
            <div className="field">
              <label htmlFor="inboundAirline">חברה, חזור</label>
              <select id="inboundAirline" name="inboundAirline" defaultValue="">
                <option value="">— עדיין לא ידוע —</option>
                {airlines.map((a) => <option key={a.code} value={a.code}>{a.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="inboundFlightNumber">מספר טיסה</label>
              <input id="inboundFlightNumber" name="inboundFlightNumber" inputMode="numeric" />
            </div>
          </div>
          <div className="grid2">
            <div className="field">
              <label htmlFor="outboundArrivesTime">נחיתה ביעד</label>
              <input id="outboundArrivesTime" name="outboundArrivesTime" type="time" />
            </div>
            <div className="field">
              <label htmlFor="inboundArrivesTime">נחיתה בארץ</label>
              <input id="inboundArrivesTime" name="inboundArrivesTime" type="time" />
            </div>
          </div>
          <p className="hint">בלי שעות, התיק ייפתח עם 08:00 ו-20:00 ותוכלו לתקן מהתיק.</p>
        </div>
      </details>

      <details className="collapse form-more" open={showMoney} onToggle={(e) => setShowMoney(e.currentTarget.open)}>
        <summary>
          כסף
          <span className="hint">כמה שולם ומה העלות. הרווח נגזר מההפרש.</span>
        </summary>
        <div style={{ padding: "0 0.85rem 0.85rem" }} className="grid2">
          <div className="field">
            <label htmlFor="amountPaid">שולם עד כה</label>
            <input id="amountPaid" name="amountPaid" type="number" min="0" step="1" defaultValue="0" />
          </div>
          <div className="field">
            <label htmlFor="supplierCost">עלות ספקים משוערת</label>
            <input id="supplierCost" name="supplierCost" type="number" min="0" step="1" defaultValue="0" />
          </div>
        </div>
      </details>

      <div style={{ padding: "0 0.75rem 1.5rem" }}>
        <button className="btn-primary btn-lg" type="submit" disabled={pending} style={{ width: "100%" }}>
          {pending ? "פותח תיק…" : "פתיחת תיק"}
        </button>
        <p className="hint" style={{ textAlign: "center", marginTop: "0.5rem" }}>
          התיק נפתח עם תאריך היום כמועד התשלום. אם הוא שולם קודם — תקנו מהתיק.
        </p>
      </div>
    </form>
  );
}
