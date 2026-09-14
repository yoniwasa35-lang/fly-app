"use client";

import { useActionState } from "react";
import { createClientAction, type NewClientState } from "./actions";
import { Icon } from "@/components/Icon";

export function NewClientForm() {
  const [state, action, pending] = useActionState<NewClientState, FormData>(createClientAction, {});

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
          <label htmlFor="name">שם</label>
          <input id="name" name="name" required autoFocus placeholder="משפחת כהן" />
        </div>

        <div className="field">
          <label htmlFor="phone">טלפון</label>
          <input id="phone" name="phone" type="tel" required inputMode="tel" placeholder="050-0000000" />
          <p className="hint">זה הערוץ שדרכו נשלחות ההודעות בוואטסאפ.</p>
        </div>

        <div className="field">
          <label htmlFor="email">מייל (לא חובה)</label>
          <input id="email" name="email" type="email" inputMode="email" />
        </div>

        <div className="field">
          <label htmlFor="notes">הערות (לא חובה)</label>
          <textarea id="notes" name="notes" placeholder="העדפות, אלרגיות, מועדון נוסע מתמיד…" />
        </div>

        <button className="btn-primary btn-lg" type="submit" disabled={pending} style={{ width: "100%" }}>
          {pending ? "שומר…" : "שמירת לקוח"}
        </button>
      </div>
    </form>
  );
}
