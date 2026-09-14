"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { addHotelAction } from "./actions";
import { StayEditor, type StayDraft } from "./StayEditor";

/**
 * המלון, בתוך החלון שלו.
 *
 * כשאין מלון — שדה אחד, שם, וזהו. כל השאר (חדר, אירוח, שעות, כתובת,
 * אתר) נפתח מיד אחרי ההוספה ואפשר למלא אותו בקצב. לבקש עשרה שדות כדי
 * לרשום "Hilton Batumi" זה מה שגורם לאנשים לוותר ולכתוב את זה בהערות.
 */
export function HotelPanel({
  tripId, initial, summary,
}: {
  tripId: string;
  /** null כשעוד אין רכיב מלון בתיק. */
  initial: StayDraft | null;
  /** שורת התאריכים והסטטוס, מחושבת בשרת. */
  summary: React.ReactNode;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    startTransition(async () => {
      const res = await addHotelAction(tripId, name);
      if (res.error) setError(res.error);
    });
  }

  if (!initial) {
    return (
      <>
        {error && (
          <div className="error" role="alert" style={{ margin: "0 0 var(--sp-4)" }}>
            <Icon name="alert" />
            <span>{error}</span>
          </div>
        )}

        <div className="field">
          <label htmlFor="hotel-new">שם המלון</label>
          <input
            id="hotel-new"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Hilton Batumi"
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim().length >= 2) {
                e.preventDefault();
                create();
              }
            }}
          />
          <p className="hint">אחרי ההוספה אפשר למלא חדר, אירוח, שעות, כתובת ואתר.</p>
        </div>

        <button
          className="btn-primary btn-lg"
          type="button"
          onClick={create}
          disabled={pending || name.trim().length < 2}
          style={{ width: "100%" }}
        >
          {pending ? "מוסיף…" : "הוספת מלון"}
        </button>
      </>
    );
  }

  return (
    <>
      <h3 className="leg-title">{initial.name}</h3>
      {summary}
      <StayEditor initial={initial} />
    </>
  );
}
