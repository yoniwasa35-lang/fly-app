"use client";

import { useState, useTransition } from "react";
import { rotatePublicTokenAction } from "@/app/actions";

/**
 * הקישור לעמוד הלקוח. הוא נשלח בוואטסאפ ומגיע גם לבד בתוך ההודעות שמכילות
 * את המשתנה {{קישור_ללקוח}}; הפאנל הזה הוא לשליחה נקודתית ולהחלפה.
 *
 * אין כאן התחברות — הקישור עצמו הוא הסוד. לכן יש כפתור להחלפתו: אם לקוח
 * העביר אותו הלאה, הישן מת והחדש נשלח.
 */
export function ClientLinkPanel({
  tripId, url, clientName, destination, waUrl,
}: {
  tripId: string;
  url: string;
  clientName: string;
  destination: string;
  waUrl: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!url) {
    return (
      <div className="card">
        <h2>עמוד הלקוח</h2>
        <div className="error" style={{ margin: 0 }}>
          לא הוגדר <code>PUBLIC_BASE_URL</code>, ולכן אי אפשר לבנות את הקישור.
          הודעות שמכילות אותו ייחסמו לפני שליחה.
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>עמוד הלקוח</h2>
      <p className="hint">
        עמוד web בקישור אישי, בלי סיסמה. מציג ספירה לאחור, מה סגור, מה נשאר, ופרטי הטיסות.
      </p>

      {error && <div className="error" style={{ margin: "0.5rem 0" }}>{error}</div>}

      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} dir="ltr" aria-label="הקישור ללקוח" />

      <div className="actions" style={{ marginTop: "0.6rem" }}>
        <a className="btn" href={url} target="_blank" rel="noopener noreferrer">פתיחה</a>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(url).then(
              () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
              () => setError("הדפדפן לא אפשר העתקה. סמנו את הטקסט והעתיקו ידנית."),
            );
          }}
        >
          {copied ? "הועתק ✓" : "העתקה"}
        </button>
        {waUrl && (
          <a className="btn btn-wa" href={waUrl} target="_blank" rel="noopener noreferrer">
            שליחה בוואטסאפ
          </a>
        )}
      </div>

      {confirming ? (
        <div className="error" style={{ marginTop: "0.7rem" }}>
          הקישור הנוכחי יפסיק לעבוד מיד, גם אצל הלקוח. צריך לשלוח לו את החדש.
          <div className="actions" style={{ marginTop: "0.5rem" }}>
            <button
              className="btn-primary"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const res = await rotatePublicTokenAction(tripId);
                  if (!res.ok) setError(res.error);
                  else setConfirming(false);
                });
              }}
            >
              כן, להחליף
            </button>
            <button className="btn-quiet" onClick={() => setConfirming(false)}>ביטול</button>
          </div>
        </div>
      ) : (
        <button className="btn-quiet" style={{ marginTop: "0.5rem" }} onClick={() => setConfirming(true)}>
          החלפת הקישור
        </button>
      )}
    </div>
  );
}
