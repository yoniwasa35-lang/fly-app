"use client";

import { useState } from "react";
import type { PrepareMessageResult } from "@/app/actions";

type Prepared = Extract<PrepareMessageResult, { ok: true }>["message"];

/**
 * סעיף 9: המערכת מכינה את הנוסח, הסוכן לוחץ שלח.
 *
 * הטקסט ניתן לעריכה אחרונה לפני השליחה — זו נקודה מפורשת באפיון, ולא
 * נוחות. הכפתור לא נפתח כל עוד נשאר בטקסט משתנה שלא מולא, כדי שלא תישלח
 * ללקוח הודעה עם סוגריים מסולסלים באמצע.
 */
export function WhatsAppPanel({
  prepared,
  onSent,
  onCancel,
}: {
  prepared: Prepared;
  onSent: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(prepared.text);
  const [opened, setOpened] = useState(false);

  const unfilled = /\{\{[^}]+\}\}/.test(text);
  const canSend = !unfilled && !!prepared.phoneE164 && text.trim().length > 0;
  const url = prepared.phoneE164
    ? `https://wa.me/${prepared.phoneE164}?text=${encodeURIComponent(text)}`
    : "";

  return (
    <div className="wa-panel">
      <div className="wa-head">
        <strong>{prepared.clientName}</strong>
        {prepared.phoneDisplay ? (
          <span className="num">{prepared.phoneDisplay}</span>
        ) : (
          <span className="tag tag-overdue">{prepared.waError ?? "אין טלפון תקין"}</span>
        )}
      </div>

      {prepared.missing.length > 0 && (
        <div className="wa-warn">
          חסרים נתונים:{" "}
          {prepared.missing
            .map((m) => (m.envVar ? `${m.name} (הגדירו ${m.envVar})` : m.name))
            .join(", ")}
          . השלימו בטקסט או תקנו בתיק.
        </div>
      )}

      {prepared.unknown.length > 0 && (
        <div className="wa-warn">
          התבנית מבקשת משתנים שלא קיימים: {prepared.unknown.join(", ")}. בדקו את הנוסח במסך התבניות.
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(16, text.split("\n").length + 2)}
        aria-label="נוסח ההודעה"
        dir="rtl"
      />

      <div className="wa-actions">
        {canSend ? (
          <a
            className="btn btn-wa"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpened(true)}
          >
            פתיחת וואטסאפ
          </a>
        ) : (
          <button className="btn" disabled title={unfilled ? "נשארו משתנים שלא מולאו" : undefined}>
            פתיחת וואטסאפ
          </button>
        )}

        <button className={opened ? "btn-primary" : "btn-quiet"} onClick={onSent}>
          סימון כנשלח
        </button>
        <button className="btn-quiet" onClick={onCancel}>
          ביטול
        </button>
      </div>

      {unfilled && (
        <p className="hint">נשארו בטקסט משתנים בסוגריים מסולסלים. מחקו או השלימו אותם כדי לשלוח.</p>
      )}
    </div>
  );
}
