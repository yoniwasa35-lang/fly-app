"use client";

import { useActionState } from "react";
import { createTripAction, type NewTripState } from "./actions";

type Option = { code?: string; iata?: string; label: string };

/**
 * הזנה ידנית היא אויב המערכת (סעיף 4), ולכן הטופס מבקש רק את מה שאי אפשר
 * לגזור: לקוח, יעד, שני מועדים ושני שדות. נוסעים, רכיבים וכספים מתווספים
 * בתיק עצמו — אבן דרך ייעודית כבר מזכירה לעשות זאת.
 */
export function NewTripForm({
  templates, airports, airlines,
}: {
  templates: Array<{ id: string; title: string }>;
  airports: Array<{ iata: string; label: string }>;
  airlines: Array<{ code: string; label: string }>;
}) {
  const [state, formAction, pending] = useActionState<NewTripState, FormData>(createTripAction, {});

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      <div className="card">
        <h2>לקוח</h2>
        <div className="grid2">
          <div className="field">
            <label htmlFor="clientName">שם</label>
            <input id="clientName" name="clientName" required autoFocus autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="clientPhone">טלפון</label>
            <input id="clientPhone" name="clientPhone" type="tel" inputMode="tel" required
              placeholder="050-0000000" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="destination">יעד</label>
          <input id="destination" name="destination" required placeholder="אתונה" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="templateId">סוג הנסיעה</label>
          <select id="templateId" name="templateId" defaultValue={templates[0]?.id}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          <p className="hint">קובע אילו אבני דרך ייווצרו ובאילו מועדים.</p>
        </div>
      </div>

      <div className="card">
        <h2>יציאה</h2>
        <p className="hint" style={{ marginTop: "-0.4rem", marginBottom: "0.6rem" }}>
          השעות הן תמיד בשעון השדה עצמו, לא בשעון ישראל.
        </p>
        <div className="field">
          <label htmlFor="departureAirport">שדה יציאה</label>
          <select id="departureAirport" name="departureAirport" defaultValue="TLV">
            {airports.map((a) => (
              <option key={a.iata} value={a.iata}>{a.label}</option>
            ))}
          </select>
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="departureDate">תאריך</label>
            <input id="departureDate" name="departureDate" type="date" required />
          </div>
          <div className="field">
            <label htmlFor="departureTime">שעה</label>
            <input id="departureTime" name="departureTime" type="time" required defaultValue="06:00" />
          </div>
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="outboundAirline">חברת תעופה</label>
            <select id="outboundAirline" name="outboundAirline" defaultValue="">
              <option value="">— לא ידוע עדיין —</option>
              {airlines.map((a) => (
                <option key={a.code} value={a.code}>{a.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="outboundFlightNumber">מספר טיסה</label>
            <input id="outboundFlightNumber" name="outboundFlightNumber" inputMode="numeric" placeholder="971" />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>חזרה</h2>
        <div className="field">
          <label htmlFor="returnAirport">שדה חזרה</label>
          <select id="returnAirport" name="returnAirport" defaultValue="">
            <option value="" disabled>בחרו שדה</option>
            {airports.map((a) => (
              <option key={a.iata} value={a.iata}>{a.label}</option>
            ))}
          </select>
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="returnDate">תאריך</label>
            <input id="returnDate" name="returnDate" type="date" required />
          </div>
          <div className="field">
            <label htmlFor="returnTime">שעה</label>
            <input id="returnTime" name="returnTime" type="time" required defaultValue="20:00" />
          </div>
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="inboundAirline">חברת תעופה</label>
            <select id="inboundAirline" name="inboundAirline" defaultValue="">
              <option value="">— לא ידוע עדיין —</option>
              {airlines.map((a) => (
                <option key={a.code} value={a.code}>{a.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="inboundFlightNumber">מספר טיסה</label>
            <input id="inboundFlightNumber" name="inboundFlightNumber" inputMode="numeric" placeholder="972" />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>כסף</h2>
        <div className="grid2">
          <div className="field">
            <label htmlFor="priceToClient">מחיר ללקוח</label>
            <input id="priceToClient" name="priceToClient" type="number" min="0" step="1" defaultValue="0" />
          </div>
          <div className="field">
            <label htmlFor="amountPaid">שולם עד כה</label>
            <input id="amountPaid" name="amountPaid" type="number" min="0" step="1" defaultValue="0" />
          </div>
        </div>
        <p className="hint">כשהשולם מגיע למחיר, אבן הדרך של גביית היתרה נסגרת לבד.</p>
      </div>

      <div style={{ padding: "0 0.75rem 1.5rem" }}>
        <button className="btn-primary btn-lg" type="submit" disabled={pending} style={{ width: "100%" }}>
          {pending ? "פותח תיק…" : "פתיחת תיק"}
        </button>
      </div>
    </form>
  );
}
