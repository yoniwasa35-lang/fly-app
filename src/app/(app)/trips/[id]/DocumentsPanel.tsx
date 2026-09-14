"use client";

import { useState, useTransition } from "react";
import { setDocumentStateAction } from "@/app/actions";
import { Icon } from "@/components/Icon";
import {
  DOCUMENT_STATE_HE,
  type DocumentRow,
  type DocumentState,
} from "@/lib/trips/documents";

/** חסר → התקבל → נשלח → חסר. לחיצה אחת מקדמת. */
const NEXT: Record<DocumentState, DocumentState> = {
  missing: "received",
  received: "sent",
  sent: "missing",
};

export function DocumentsPanel({ tripId, rows }: { tripId: string; rows: DocumentRow[] }) {
  const [local, setLocal] = useState(rows);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function advance(row: DocumentRow) {
    const next = NEXT[row.state];
    // עדכון אופטימי: הרשימה זזה מיד, והשרת מדביק. סוכן שמסמן חמישה
    // מסמכים ברצף לא צריך לחכות לרשת בין לחיצה ללחיצה.
    setLocal((prev) => prev.map((r) => (r.kind === row.kind ? { ...r, state: next } : r)));
    setError(null);

    startTransition(async () => {
      const res = await setDocumentStateAction(tripId, row.kind, next);
      if (!res.ok) {
        setLocal((prev) => prev.map((r) => (r.kind === row.kind ? { ...r, state: row.state } : r)));
        setError(res.error);
      }
    });
  }

  return (
    <>
      {error && (
        <div className="error" style={{ margin: "0 0 var(--sp-4)" }}>
          <Icon name="alert" />
          <span>{error}</span>
        </div>
      )}

      <ul className="doc-list">
        {local.map((row) => (
          <li key={row.kind}>
            <button
              type="button"
              className={`doc-row is-${row.state}`}
              onClick={() => advance(row)}
              disabled={pending}
              aria-label={`${row.label} — ${DOCUMENT_STATE_HE[row.state]}. לחיצה מקדמת לשלב הבא.`}
            >
              <span className="doc-mark" aria-hidden="true">
                {row.state === "sent" ? <Icon name="check" /> : null}
              </span>
              <span className="doc-label">{row.label}</span>
              <span className="doc-state">{DOCUMENT_STATE_HE[row.state]}</span>
            </button>
          </li>
        ))}
      </ul>

      <p className="hint" style={{ marginTop: "var(--sp-4)" }}>
        לחיצה מקדמת: חסר ← התקבל מהספק ← נשלח ללקוח. רק "נשלח" נספר כמוכן — מסמך
        שיושב אצלכם לא עוזר למי שעומד בקבלה של המלון.
      </p>
      <p className="hint">צירוף קובץ עדיין לא נתמך. הצ׳ק-ליסט עוקב אחרי הסטטוס בלבד.</p>
    </>
  );
}
