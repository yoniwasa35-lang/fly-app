"use client";

import { useState, useTransition } from "react";
import { saveTripCoverAction } from "@/app/actions";
import { Icon } from "@/components/Icon";

/**
 * תמונת הקאבר של עמוד הלקוח.
 *
 * הקרדיט אינו שדה רשות: רישיון Unsplash מחייב ייחוס, והשרת דוחה תמונה
 * בלי קרדיט. עדיף שהסוכן ייתקל בזה כאן מאשר שהעסק יפר רישיון בשקט.
 */
export function CoverEditor({
  tripId, imageUrl, credit,
}: {
  tripId: string;
  imageUrl: string;
  credit: string;
}) {
  const [url, setUrl] = useState(imageUrl);
  const [text, setText] = useState(credit);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveTripCoverAction(tripId, url || null, text || null);
      if (res.ok) setSaved(true);
      else setError(res.error);
    });
  }

  return (
    <div className="card">
      <h2>תמונת הקאבר</h2>
      <p className="hint">
        מופיעה בראש עמוד הלקוח. בלעדיה העמוד מציג רקע מדורג — לא תמונה שבורה.
      </p>

      {error && (
        <div className="error" role="alert" style={{ margin: "var(--sp-3) 0" }}>
          <Icon name="alert" />
          <span>{error}</span>
        </div>
      )}

      {url && (
        <img className="cover-preview" src={url} alt="" />
      )}

      <div className="field">
        <label htmlFor="cover-url">כתובת התמונה</label>
        <input
          id="cover-url"
          type="url"
          inputMode="url"
          dir="ltr"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setSaved(false); }}
          placeholder="https://images.unsplash.com/…"
        />
      </div>

      <div className="field">
        <label htmlFor="cover-credit">קרדיט</label>
        <input
          id="cover-credit"
          value={text}
          onChange={(e) => { setText(e.target.value); setSaved(false); }}
          placeholder="צילום: שם הצלם, Unsplash"
        />
      </div>

      <button className="btn-primary" type="button" onClick={save} disabled={pending}>
        {pending ? "שומר…" : saved ? "נשמר" : "שמירה"}
      </button>
    </div>
  );
}
