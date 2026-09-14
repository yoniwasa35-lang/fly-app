"use client";

import { useActionState, useEffect, useState } from "react";
import { createClientAction, type NewClientState } from "./actions";
import { Icon } from "@/components/Icon";
import {
  PARTY_DEFAULTS,
  PARTY_TYPES,
  PARTY_TYPE_HE,
  type PartyType,
} from "@/lib/clients/party";

/** דפדפן שתומך בבורר אנשי הקשר. נכון להיום: כרום באנדרואיד בלבד. */
type ContactsApi = {
  select: (props: string[], opts?: { multiple?: boolean }) => Promise<
    { name?: string[]; tel?: string[] }[]
  >;
};

function Stepper({
  label, name, value, onChange, min = 0, max = 30,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-controls">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`פחות ${label}`}
        >
          −
        </button>
        <output className="num" aria-live="polite">{value}</output>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`עוד ${label}`}
        >
          +
        </button>
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

export function NewClientForm() {
  const [state, action, pending] = useActionState<NewClientState, FormData>(createClientAction, {});

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [partyType, setPartyType] = useState<PartyType>("couple");
  const [adults, setAdults] = useState(PARTY_DEFAULTS.couple.adults);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [ages, setAges] = useState<number[]>([]);
  const [contacts, setContacts] = useState<ContactsApi | null>(null);

  // בורר אנשי הקשר קיים רק בחלק מהדפדפנים. בודקים בצד הלקוח בלבד,
  // ולא מציגים כפתור שלא יעשה כלום.
  useEffect(() => {
    const api = (navigator as Navigator & { contacts?: ContactsApi }).contacts;
    if (api && "ContactsManager" in window) setContacts(api);
  }, []);

  // מספר הגילאים עוקב אחרי מספר הילדים, בלי לאבד מה שכבר הוקלד.
  useEffect(() => {
    setAges((prev) => {
      const next = prev.slice(0, children);
      while (next.length < children) next.push(0);
      return next;
    });
  }, [children]);

  function choose(t: PartyType) {
    setPartyType(t);
    const d = PARTY_DEFAULTS[t];
    setAdults(d.adults);
    setChildren(d.children);
    setInfants(d.infants);
  }

  async function pickContact() {
    if (!contacts) return;
    try {
      const [picked] = await contacts.select(["name", "tel"], { multiple: false });
      if (picked?.name?.[0]) setName(picked.name[0]);
      if (picked?.tel?.[0]) setPhone(picked.tel[0].replace(/[^\d+]/g, ""));
    } catch {
      // המשתמש ביטל את הבחירה. אין מה לדווח.
    }
  }

  const counted = partyType === "family" || partyType === "group";

  return (
    <form action={action}>
      {state.error && (
        <div className="error" role="alert">
          <Icon name="alert" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="card">
        <div className="field">
          <label htmlFor="name">שם מלא</label>
          <input
            id="name"
            name="name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="עידן ואביטל כהן"
          />
        </div>

        <div className="field">
          <label htmlFor="phone">טלפון</label>
          <div className="input-row">
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="050-0000000"
            />
            {contacts && (
              <button type="button" onClick={pickContact}>
                <Icon name="clients" />
                <span>אנשי קשר</span>
              </button>
            )}
          </div>
          <p className="hint">זה הערוץ שדרכו נשלחות ההודעות בוואטסאפ.</p>
        </div>
      </div>

      <div className="card">
        <h2>הרכב נוסעים</h2>

        <div className="choice-row" role="group" aria-label="הרכב נוסעים">
          {PARTY_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={partyType === t ? "btn-primary" : ""}
              aria-pressed={partyType === t}
              onClick={() => choose(t)}
            >
              {PARTY_TYPE_HE[t]}
            </button>
          ))}
        </div>
        <input type="hidden" name="partyType" value={partyType} />

        {counted ? (
          <div className="steppers">
            <Stepper label="מבוגרים" name="adults" value={adults} onChange={setAdults} min={1} />
            <Stepper label="ילדים" name="children" value={children} onChange={setChildren} max={20} />
            <Stepper label="תינוקות" name="infants" value={infants} onChange={setInfants} max={10} />
          </div>
        ) : (
          <>
            <p className="hint">
              {partyType === "solo" ? "נוסע אחד." : "שני מבוגרים."} אפשר לשנות בכל נסיעה.
            </p>
            <input type="hidden" name="adults" value={adults} />
            <input type="hidden" name="children" value={children} />
            <input type="hidden" name="infants" value={infants} />
          </>
        )}

        {children > 0 && (
          <div className="ages">
            <span className="stepper-label">גילאי הילדים (לא חובה)</span>
            <div className="ages-row">
              {ages.map((age, i) => (
                <input
                  key={i}
                  type="number"
                  min={0}
                  max={17}
                  value={age || ""}
                  aria-label={`גיל ילד ${i + 1}`}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setAges((prev) => prev.map((a, j) => (j === i ? v : a)));
                  }}
                />
              ))}
            </div>
            <p className="hint">משפיע על מחיר, על מושב ברכב ועל סוג החדר.</p>
            <input type="hidden" name="childAges" value={ages.filter(Boolean).join(",")} />
          </div>
        )}
      </div>

      <details className="collapse form-more">
        <summary>
          פרטים נוספים
          <span className="hint">מייל והערות. אפשר להשלים אחר כך.</span>
        </summary>
        <div className="card">
          <div className="field">
            <label htmlFor="email">מייל</label>
            <input id="email" name="email" type="email" inputMode="email" />
          </div>
          <div className="field">
            <label htmlFor="notes">הערות</label>
            <textarea id="notes" name="notes" placeholder="העדפות, אלרגיות, מועדון נוסע מתמיד…" />
          </div>
        </div>
      </details>

      <div className="submit-bar">
        <button
          className="btn-primary btn-lg"
          type="submit"
          name="then"
          value="trip"
          disabled={pending}
        >
          <Icon name="trips" />
          <span>{pending ? "שומר…" : "שמירה ופתיחת נסיעה"}</span>
        </button>
        <button type="submit" name="then" value="client" disabled={pending} className="btn-quiet">
          שמירה בלבד
        </button>
      </div>
    </form>
  );
}
